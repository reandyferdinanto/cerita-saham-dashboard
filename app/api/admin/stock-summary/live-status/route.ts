import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getQuotes } from "@/lib/yahooFinance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TradePlanInput = {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
};

type LiveTickerInput = {
  ticker: string;
  tradePlan: TradePlanInput | null;
};

type LiveStatus =
  | "setup_valid"      // Price between SL and TP1 — original setup still actionable
  | "near_sl"          // Price within 1% of SL — high risk
  | "sl_hit"           // Price already at or below SL — setup invalidated
  | "tp1_reached"      // Price at or above TP1 — partial profit zone
  | "tp2_reached"      // Price at or above TP2 — extended target hit
  | "above_entry"      // Price already above entry — chasing risk
  | "better_entry"     // Price near or below entry but above SL — possibly better entry
  | "no_plan";         // No trade plan available

type LiveResult = {
  ticker: string;
  currentPrice: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  status: LiveStatus;
  recommendation: string;
  pricedSinceEntry: number | null; // % from screening entry
  distanceToSL: number | null; // % from current to SL (positive = SL still below)
  distanceToTP1: number | null; // % from current to TP1
  intradayLowHitSL: boolean; // true if today's low touched/breached SL
};

function classifyStatus(currentPrice: number, plan: TradePlanInput, intradayLow: number): LiveStatus {
  if (currentPrice <= plan.stopLoss || intradayLow <= plan.stopLoss) return "sl_hit";
  const slDistance = (currentPrice - plan.stopLoss) / currentPrice;
  if (slDistance <= 0.01) return "near_sl";
  if (currentPrice >= plan.takeProfit2) return "tp2_reached";
  if (currentPrice >= plan.takeProfit1) return "tp1_reached";
  if (currentPrice <= plan.entry * 1.005) return "better_entry";
  if (currentPrice >= plan.entry * 1.03) return "above_entry";
  return "setup_valid";
}

function buildRecommendation(status: LiveStatus, plan: TradePlanInput | null, currentPrice: number | null, intradayLow: number | null): string {
  if (!plan || currentPrice == null) return "Trade plan tidak tersedia.";

  switch (status) {
    case "sl_hit":
      if (intradayLow != null && intradayLow <= plan.stopLoss && currentPrice > plan.stopLoss) {
        return `SL ${plan.stopLoss} sudah disentuh intraday (low ${intradayLow}). Setup invalid — skip.`;
      }
      return `Harga ${currentPrice} sudah di bawah SL ${plan.stopLoss}. Setup invalid — cut loss jika sudah masuk.`;
    case "near_sl":
      return `Sangat dekat dengan SL ${plan.stopLoss}. Risiko tinggi — bukan entry zone.`;
    case "tp1_reached":
      return `Sudah menyentuh TP1 ${plan.takeProfit1}. Pertimbangkan ambil sebagian profit, geser SL ke entry.`;
    case "tp2_reached":
      return `Sudah menyentuh TP2 ${plan.takeProfit2}. Setup sudah berjalan — fokus exit, bukan entry baru.`;
    case "above_entry":
      return `Sudah +${(((currentPrice - plan.entry) / plan.entry) * 100).toFixed(1)}% dari entry ${plan.entry}. Mengejar di sini berisiko — tunggu pullback ke ${plan.entry}.`;
    case "better_entry":
      return `Harga ${currentPrice} dekat/di bawah entry awal ${plan.entry}, masih di atas SL. Risk/reward sebenarnya lebih baik dibanding screening — entry valid.`;
    case "setup_valid":
      return `Setup masih valid. Harga di antara entry ${plan.entry} dan TP1 ${plan.takeProfit1}.`;
    case "no_plan":
      return "Trade plan tidak tersedia.";
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { tickers: LiveTickerInput[] };
    if (!Array.isArray(body.tickers) || body.tickers.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const planMap = new Map<string, TradePlanInput | null>();
    const yahooTickers: string[] = [];
    for (const item of body.tickers) {
      const code = item.ticker.toUpperCase().replace(/\.JK$/i, "");
      const yahooSymbol = `${code}.JK`;
      planMap.set(code, item.tradePlan);
      yahooTickers.push(yahooSymbol);
    }

    const quotes = await getQuotes(yahooTickers).catch(() => [] as Awaited<ReturnType<typeof getQuotes>>);
    const quoteMap = new Map<string, (typeof quotes)[number]>();
    for (const quote of quotes) {
      const code = quote.ticker.toUpperCase().replace(/\.JK$/i, "");
      quoteMap.set(code, quote);
    }

    const results: LiveResult[] = body.tickers.map((item) => {
      const code = item.ticker.toUpperCase().replace(/\.JK$/i, "");
      const plan = planMap.get(code) ?? null;
      const quote = quoteMap.get(code);

      if (!quote || !quote.price) {
        return {
          ticker: code,
          currentPrice: null,
          changePercent: null,
          high: null,
          low: null,
          previousClose: null,
          status: "no_plan",
          recommendation: "Data live tidak tersedia.",
          pricedSinceEntry: null,
          distanceToSL: null,
          distanceToTP1: null,
          intradayLowHitSL: false,
        };
      }

      const currentPrice = quote.price;
      const intradayLow = quote.low || currentPrice;

      if (!plan) {
        return {
          ticker: code,
          currentPrice,
          changePercent: quote.changePercent,
          high: quote.high,
          low: quote.low,
          previousClose: quote.previousClose,
          status: "no_plan",
          recommendation: "Trade plan tidak tersedia untuk kandidat ini.",
          pricedSinceEntry: null,
          distanceToSL: null,
          distanceToTP1: null,
          intradayLowHitSL: false,
        };
      }

      const status = classifyStatus(currentPrice, plan, intradayLow);
      const recommendation = buildRecommendation(status, plan, currentPrice, intradayLow);
      const intradayLowHitSL = intradayLow <= plan.stopLoss;
      const pricedSinceEntry = ((currentPrice - plan.entry) / plan.entry) * 100;
      const distanceToSL = ((currentPrice - plan.stopLoss) / currentPrice) * 100;
      const distanceToTP1 = ((plan.takeProfit1 - currentPrice) / currentPrice) * 100;

      return {
        ticker: code,
        currentPrice,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        status,
        recommendation,
        pricedSinceEntry: Number(pricedSinceEntry.toFixed(2)),
        distanceToSL: Number(distanceToSL.toFixed(2)),
        distanceToTP1: Number(distanceToTP1.toFixed(2)),
        intradayLowHitSL,
      };
    });

    return NextResponse.json({ data: results, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat live status" },
      { status: 500 }
    );
  }
}
