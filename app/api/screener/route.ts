import { NextResponse } from "next/server";
import { calcTechnicalSignals, OHLCVBar } from "@/lib/technicalSignals";

// yahoo-finance2 v3
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YF = require("yahoo-finance2").default ?? require("yahoo-finance2");
const yf = new YF({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

// ── Comprehensive IDX universe ~200 most-traded stocks ────────────────────────
// Source: BEI LQ45, IDX30, IDX80, IDX SMC Composite + aktif diperdagangkan
const IDX_UNIVERSE = [
  // LQ45 / Blue chip
  "BBCA.JK","BBRI.JK","BMRI.JK","BBNI.JK","TLKM.JK","ASII.JK","UNVR.JK","GOTO.JK",
  "BREN.JK","AMRT.JK","ADRO.JK","ANTM.JK","INDF.JK","ICBP.JK","KLBF.JK","PGAS.JK",
  "PTBA.JK","SMGR.JK","JSMR.JK","EXCL.JK","ISAT.JK","CPIN.JK","MDKA.JK","TOWR.JK",
  "PWON.JK","CTRA.JK","BSDE.JK","SMRA.JK","MNCN.JK","EMTK.JK","MAPI.JK","ACES.JK",
  "LSIP.JK","AALI.JK","TBIG.JK","HRUM.JK","INCO.JK","MEDC.JK","INTP.JK","SIDO.JK",
  "MYOR.JK","GGRM.JK","HMSP.JK","BNGA.JK","BDMN.JK","BJTM.JK","BJBR.JK","PNBN.JK",
  "JPFA.JK","TBLA.JK",
  // IDX80 tambahan
  "ITMG.JK","BUMI.JK","PTPP.JK","WIKA.JK","WSKT.JK","ADHI.JK","NRCA.JK","TOTL.JK",
  "SSIA.JK","ACST.JK","ERAA.JK","MIKA.JK","HEAL.JK","SILO.JK","RALS.JK","LPPF.JK",
  "MPPA.JK","HERO.JK","ACES.JK","MIDI.JK","CSAP.JK","RANC.JK","DMAS.JK","BEST.JK",
  "KIJA.JK","LPKR.JK","MTLA.JK","GPRA.JK","ARMY.JK","APLN.JK","DILD.JK","PPRO.JK",
  "BKSL.JK","MKPI.JK","ASRI.JK","GMTD.JK","PLIN.JK","DART.JK","COWL.JK","JRPT.JK",
  // Perbankan & keuangan
  "BNLI.JK","NISP.JK","BTPS.JK","BRIS.JK","MEGA.JK","BACA.JK","AGRO.JK","BBYB.JK",
  "BBKP.JK","BNBA.JK","BGTG.JK","BMAS.JK","BBMD.JK","NOBU.JK","DNAR.JK","LIFE.JK",
  "BFIN.JK","ADMF.JK","CFIN.JK","MFIN.JK","VRNA.JK","IMJS.JK","PNLF.JK","LPPS.JK",
  // Energi & tambang
  "INDY.JK","DOID.JK","TOBA.JK","SMMT.JK","BOSS.JK","GEMS.JK","KKGI.JK","MYOH.JK",
  "FIRE.JK","BSSR.JK","MCOL.JK","HPMA.JK","GTBO.JK","PKPK.JK","MBAP.JK","ARII.JK",
  "PSAB.JK","SMCB.JK","MITI.JK","MITI.JK","RUIS.JK","ENRG.JK","ELSA.JK","PKTT.JK",
  // Konsumer & retail
  "ICBP.JK","ULTJ.JK","CAMP.JK","CLEO.JK","GOOD.JK","KEJU.JK","SKLT.JK","SMAR.JK",
  "AISA.JK","DLTA.JK","MLBI.JK","RDTX.JK","SKBM.JK","ROTI.JK","TBIG.JK","ALTO.JK",
  "ADES.JK","HOKI.JK","BTEK.JK","PCAR.JK","MGNA.JK","KINO.JK","KBLI.JK","SCCO.JK",
  // Teknologi & telko
  "DNET.JK","EDGE.JK","MTDL.JK","MLPT.JK","ATIC.JK","DOOH.JK","AXIO.JK","NFCX.JK",
  "PTSN.JK","ITSB.JK","MTEL.JK","WIFI.JK","RUNS.JK","INET.JK","LSAT.JK","CBPE.JK",
  // Farmasi & kesehatan
  "KAEF.JK","INAF.JK","MERK.JK","PYFA.JK","TSPC.JK","DVLA.JK","SCPI.JK","SIDO.JK",
  "SOHO.JK","KPAS.JK","PRIM.JK","PMMP.JK","CSLI.JK","ATIC.JK","PEHA.JK","BIOS.JK",
  // Properti & konstruksi
  "DUTI.JK","SMDM.JK","BIPP.JK","OMRE.JK","NIRO.JK","LCGP.JK","SATU.JK","IDEA.JK",
  // Otomotif & industri
  "AUTO.JK","IMAS.JK","INDS.JK","LPIN.JK","SMSM.JK","GJTL.JK","GDYR.JK","MASA.JK",
  "KBLM.JK","VOKS.JK","GMFI.JK","INTA.JK","MDRN.JK","HEXA.JK","TURI.JK","UNTR.JK",
  // Agribisnis & perkebunan
  "SSMS.JK","DSNG.JK","SIMP.JK","PALM.JK","TAPG.JK","UNSP.JK","SGRO.JK","SMAR.JK",
  "BWPT.JK","GZCO.JK","JAWA.JK","ANDI.JK","TBLA.JK","MAGP.JK","CSRA.JK","PANI.JK",
];

// Deduplicate
const UNIVERSE = [...new Set(IDX_UNIVERSE)];

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
  const rows: ScreenerRow[] = [];

  // ── Batch fetch quotes (10 at a time to avoid rate limit) ─────────────────
  const BATCH = 10;
  for (let i = 0; i < UNIVERSE.length; i += BATCH) {
    const batch = UNIVERSE.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          // 1. Quote — gives us price, change%, vol, 52W high/low, avg vol, P/E
          const q: any = await yf.quote(ticker);
          if (!q || !q.regularMarketPrice) return;

          const price = q.regularMarketPrice ?? 0;
          const changePercent = (() => {
            const prev = q.regularMarketPreviousClose ?? 0;
            return prev > 0 ? ((price - prev) / prev) * 100 : 0;
          })();
          const volume = q.regularMarketVolume ?? 0;
          const avgVolume = q.averageDailyVolume3Month ?? q.averageDailyVolume10Day ?? 1;
          const volSpikeRatio = avgVolume > 0 ? volume / avgVolume : 1;
          const high52 = q.fiftyTwoWeekHigh ?? price;
          const low52 = q.fiftyTwoWeekLow ?? price;
          const pctFrom52High = high52 > 0 ? ((price - high52) / high52) * 100 : 0;
          const isBreakout52W = price >= high52 * 0.98;
          const trailingPE = q.trailingPE ?? null;

          // 2. Short history for RSI/MACD (60 days, fail silently)
          let rsi: number | null = null;
          let macdSignal: "bull" | "bear" | null = null;
          let signalLabel: "BUY" | "SELL" | "WAIT" = "WAIT";
          let score = 50;

          try {
            const period1 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
            const hist: any = await yf.chart(ticker, { period1, interval: "1d" });
            const quotes = (hist?.quotes ?? []).filter((b: any) => b.close != null);
            if (quotes.length >= 20) {
              const bars: OHLCVBar[] = quotes.map((b: any) => ({
                time: new Date(b.date).toISOString().split("T")[0],
                open: b.open ?? b.close,
                high: b.high ?? b.close,
                low: b.low ?? b.close,
                close: b.close,
                volume: b.volume ?? 0,
              }));
              const sig = calcTechnicalSignals(bars);
              rsi = sig.rsi;
              macdSignal = sig.macdHist != null ? (sig.macdHist > 0 ? "bull" : "bear") : null;
              signalLabel = sig.label;
              score = sig.score;
            }
          } catch { /* RSI optional */ }

          rows.push({
            ticker,
            name: q.shortName || q.longName || ticker,
            price,
            changePercent,
            volume,
            avgVolume,
            volSpikeRatio,
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52,
            pctFrom52High,
            isBreakout52W,
            rsi,
            macdSignal,
            trailingPE,
            signalLabel,
            score,
          });
        } catch { /* skip failed tickers */ }
      })
    );
  }

  rows.sort((a, b) => b.score - a.score);

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" },
  });
}
