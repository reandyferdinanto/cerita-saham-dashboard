import { NextResponse } from "next/server";
import { getQuote, getHistory } from "@/lib/yahooFinance";
import { calcTechnicalSignals, OHLCVBar } from "@/lib/technicalSignals";

// LQ45 + popular IDX stocks
const IDX_UNIVERSE = [
  "BBCA.JK","BBRI.JK","BMRI.JK","BBNI.JK","TLKM.JK",
  "ASII.JK","UNVR.JK","GOTO.JK","BREN.JK","AMRT.JK",
  "ADRO.JK","ANTM.JK","INDF.JK","ICBP.JK","KLBF.JK",
  "PGAS.JK","PTBA.JK","SMGR.JK","JSMR.JK","EXCL.JK",
  "ISAT.JK","CPIN.JK","MDKA.JK","TOWR.JK","PWON.JK",
  "CTRA.JK","BSDE.JK","SMRA.JK","MNCN.JK","EMTK.JK",
  "MAPI.JK","ACES.JK","LSIP.JK","AALI.JK","TBIG.JK",
  "HRUM.JK","INCO.JK","MEDC.JK","INTP.JK","SIDO.JK",
  "MYOR.JK","GGRM.JK","HMSP.JK","BNGA.JK","BDMN.JK",
  "BJTM.JK","BJBR.JK","PNBN.JK","JPFA.JK","TBLA.JK",
];

export interface ScreenerRow {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volSpikeRatio: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  pctFrom52High: number;
  isBreakout52W: boolean;
  rsi: number | null;
  macdSignal: "bull" | "bear" | null;
  trailingPE: number | null;
  signalLabel: "BUY" | "SELL" | "WAIT";
  score: number;
}

export async function GET() {
  // Fetch quotes in parallel batches of 10
  const batches: string[][] = [];
  for (let i = 0; i < IDX_UNIVERSE.length; i += 10) {
    batches.push(IDX_UNIVERSE.slice(i, i + 10));
  }

  const rows: ScreenerRow[] = [];

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const [quote, history] = await Promise.all([
            getQuote(ticker),
            getHistory(ticker, new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0], undefined, "1d"),
          ]);

          if (!quote || !history || history.length < 20) return;

          const bars: OHLCVBar[] = history.map((h: any) => ({
            time: h.time, open: h.open, high: h.high, low: h.low,
            close: h.close, volume: h.volume ?? 0,
          }));

          const signals = calcTechnicalSignals(bars);

          // Volume spike: last bar vs 20-day avg
          const volumes = bars.map(b => b.volume);
          const avg20Vol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
          const lastVol = volumes[volumes.length - 1];
          const volSpikeRatio = avg20Vol > 0 ? lastVol / avg20Vol : 1;

          // 52W metrics
          const highs = bars.map(b => b.high);
          const lows  = bars.map(b => b.low);
          const high52 = Math.max(...highs);
          const low52  = Math.min(...lows);
          const pctFrom52High = high52 > 0 ? ((quote.price - high52) / high52) * 100 : 0;
          const isBreakout52W = quote.price >= high52 * 0.98;

          rows.push({
            ticker,
            name: quote.name,
            price: quote.price,
            changePercent: quote.changePercent,
            volume: lastVol,
            avgVolume: avg20Vol,
            volSpikeRatio,
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52,
            pctFrom52High,
            isBreakout52W,
            rsi: signals.rsi,
            macdSignal: signals.macdHist != null ? (signals.macdHist > 0 ? "bull" : "bear") : null,
            trailingPE: null, // optional — skip PE to keep fast
            signalLabel: signals.label,
            score: signals.score,
          });
        } catch { /* skip failed tickers */ }
      })
    );
  }

  // Sort by score descending by default
  rows.sort((a, b) => b.score - a.score);

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
  });
}

