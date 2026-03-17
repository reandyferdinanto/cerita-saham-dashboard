import { NextRequest, NextResponse } from "next/server";
import { getHistory, getQuote } from "@/lib/yahooFinance";
import { calcTechnicalSignals } from "@/lib/technicalSignals";
import { requireUserSession } from "@/lib/userSession";

const SCREEN_UNIVERSE = [
  "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", "ASII.JK", "AMMN.JK", "BREN.JK", "GOTO.JK", "MEDC.JK",
  "ADRO.JK", "PTBA.JK", "ITMG.JK", "AKRA.JK", "ANTM.JK", "MDKA.JK", "CPIN.JK", "JPFA.JK", "KLBF.JK", "INET.JK",
];

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preset = req.nextUrl.searchParams.get("preset") || "momentum";

  const rows = await Promise.all(
    SCREEN_UNIVERSE.map(async (ticker) => {
      const [quote, history] = await Promise.all([
        getQuote(ticker),
        getHistory(ticker, new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], undefined, "1d"),
      ]);

      if (!quote || history.length < 60) {
        return null;
      }

      const technical = calcTechnicalSignals(history);
      const lastClose = history[history.length - 1]?.close || quote.price;
      const volumeNow = history[history.length - 1]?.volume || 0;
      const avgVolume20 = history.slice(-20).reduce((sum, item) => sum + item.volume, 0) / Math.min(history.length, 20);
      const volumeRatio = avgVolume20 > 0 ? volumeNow / avgVolume20 : 1;
      const swingFromLow = quote.price && quote.low ? ((quote.price - quote.low) / quote.low) * 100 : 0;

      return {
        ticker: quote.ticker,
        name: quote.name,
        price: quote.price,
        changePercent: quote.changePercent,
        technicalLabel: technical.label,
        score: technical.score,
        rsi: technical.rsi,
        ma20: technical.ma20,
        ma50: technical.ma50,
        volumeRatio,
        swingFromLow,
        aboveMA20: technical.ma20 ? lastClose > technical.ma20 : false,
        aboveMA50: technical.ma50 ? lastClose > technical.ma50 : false,
      };
    })
  );

  const validRows = rows.filter((row): row is NonNullable<typeof row> => Boolean(row));

  const screened = validRows.filter((row) => {
    if (preset === "breakout") {
      return row.score >= 60 && row.volumeRatio >= 1.2 && row.aboveMA20;
    }

    if (preset === "pullback") {
      return row.score >= 50 && row.rsi !== null && row.rsi <= 45 && row.aboveMA50;
    }

    if (preset === "defensive") {
      return row.changePercent > -2 && row.score >= 45 && row.swingFromLow <= 6;
    }

    return row.score >= 55 && row.changePercent >= 0;
  });

  screened.sort((a, b) => b.score - a.score || b.changePercent - a.changePercent);
  return NextResponse.json(screened.slice(0, 12));
}