import { calcTechnicalSignals, OHLCVBar } from "@/lib/technicalSignals";
import { getHistory, getQuote, searchStocks } from "@/lib/yahooFinance";

type AnalysisTone = "bullish" | "neutral" | "bearish" | "warning";

export type BandarmologyAnalysisResult = {
  ticker: string;
  name: string;
  quote: {
    price: number;
    changePercent: number;
    volume: number;
  };
  summary: {
    phase: string;
    operatorBias: string;
    conviction: number;
    actionBias: string;
    tone: AnalysisTone;
  };
  metrics: {
    priceVsMa20: number | null;
    priceVsMa50: number | null;
    rsi: number | null;
    technicalScore: number;
    volumeRatio5v20: number | null;
    upDownVolumeRatio: number | null;
    obvSlope20: number | null;
    adSlope20: number | null;
    breakoutDistancePct: number | null;
    support: number[];
    resistance: number[];
  };
  sections: {
    overview: string;
    accumulationDistribution: string;
    operatorFootprint: string;
    ryanFilbertLens: string;
    executionPlan: string;
    riskNotes: string;
  };
  chart: {
    points: {
      time: string;
      close: number;
      ma20: number | null;
      ma50: number | null;
    }[];
    annotations: {
      key: string;
      label: string;
      detail: string;
      value: number;
      color: string;
    }[];
  };
  assumptions: string[];
};

export const BANDARMOLOGY_SCREEN_UNIVERSE = Array.from(
  new Set([
    // Large liquid leaders
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", "ASII.JK", "AMMN.JK", "BREN.JK", "GOTO.JK", "MEDC.JK",
    "ADRO.JK", "PTBA.JK", "ITMG.JK", "AKRA.JK", "ANTM.JK", "MDKA.JK", "CPIN.JK", "JPFA.JK", "KLBF.JK", "ICBP.JK",
    "INDF.JK", "UNTR.JK", "SMGR.JK", "INTP.JK", "EXCL.JK", "ISAT.JK", "PGAS.JK", "TPIA.JK", "BRPT.JK", "INKP.JK",
    "TKIM.JK", "ESSA.JK", "HRUM.JK", "INDY.JK", "MAPI.JK", "MAPA.JK", "ACES.JK", "AMRT.JK", "ERAA.JK", "MIKA.JK",
    "HEAL.JK", "SIDO.JK", "BBYB.JK", "ARTO.JK", "BRIS.JK", "BTPS.JK", "PNLF.JK", "SCMA.JK", "MNCN.JK", "ELSA.JK",
    "TMAS.JK", "CLEO.JK", "SIDO.JK", "WIKA.JK", "PTPP.JK", "ADHI.JK", "JSMR.JK", "WSKT.JK", "WEGE.JK",

    // More active mid-cap / rotational names
    "INCO.JK", "UNVR.JK", "MBMA.JK", "NCKL.JK", "SMRA.JK", "PWON.JK", "CTRA.JK", "BSDE.JK", "LSIP.JK", "AALI.JK",
    "DSNG.JK", "BIRD.JK", "RALS.JK", "PANI.JK", "RATU.JK", "CUAN.JK", "NICL.JK", "DKFT.JK", "RAJA.JK", "BUKA.JK",

    // Lower-priced / active names so screener is not biased only to expensive leaders
    "BUMI.JK", "BRMS.JK", "DOID.JK", "DEWA.JK", "ENRG.JK", "WIFI.JK", "FIRE.JK", "REAL.JK", "TOSK.JK", "IOTF.JK",
    "PACK.JK", "WIRG.JK", "DGWG.JK", "MAMI.JK", "VKTR.JK", "BEBS.JK", "HUMI.JK", "SAFE.JK", "NANO.JK", "SURI.JK",
    "BKSL.JK", "BNBR.JK", "BUKA.JK", "GIAA.JK", "IPTV.JK", "BBYB.JK", "CARE.JK", "AWAN.JK",
  ])
);

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function slope(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smaSeries(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const window = values.slice(index - period + 1, index + 1);
    return mean(window);
  });
}

function computeObv(bars: OHLCVBar[]) {
  let current = 0;
  return bars.map((bar, index) => {
    if (index === 0) return 0;
    const prev = bars[index - 1];
    if (bar.close > prev.close) current += bar.volume;
    if (bar.close < prev.close) current -= bar.volume;
    return current;
  });
}

function computeADLine(bars: OHLCVBar[]) {
  let current = 0;
  return bars.map((bar) => {
    const range = bar.high - bar.low;
    const moneyFlowMultiplier = range === 0 ? 0 : ((bar.close - bar.low) - (bar.high - bar.close)) / range;
    current += moneyFlowMultiplier * bar.volume;
    return current;
  });
}

function classifyPhase(args: {
  price: number;
  ma20: number | null;
  ma50: number | null;
  obvSlope20: number;
  adSlope20: number;
  breakoutDistancePct: number | null;
  volumeRatio: number;
  priceVsMa20: number | null;
  priceVsMa50: number | null;
  rsi: number | null;
  upDownVolumeRatio: number | null;
  recentRangePct: number | null;
}) {
  const {
    price,
    ma20,
    ma50,
    obvSlope20,
    adSlope20,
    breakoutDistancePct,
    volumeRatio,
    priceVsMa20,
    priceVsMa50,
    rsi,
    upDownVolumeRatio,
    recentRangePct,
  } = args;

  const nearMa20 = priceVsMa20 !== null && priceVsMa20 >= -2.2 && priceVsMa20 <= 1.8;
  const aboveMa50 = priceVsMa50 !== null && priceVsMa50 > 0;
  const inHealthyRsiZone = rsi !== null && rsi >= 40 && rsi <= 62;
  const demandDominant = (upDownVolumeRatio ?? 0) >= 1.02;
  const rangeCompressed = recentRangePct !== null && recentRangePct <= 16;
  const nearBreakout = breakoutDistancePct !== null && breakoutDistancePct <= 8;
  const isCheapStock = price > 0 && price <= 300;
  const supportZone = priceVsMa20 !== null && priceVsMa20 >= -3.8 && priceVsMa20 <= 1.5;
  const stealthRsiZone = rsi !== null && rsi >= 35 && rsi <= 58;

  if (
    isCheapStock &&
    supportZone &&
    rangeCompressed &&
    obvSlope20 > 0 &&
    adSlope20 > 0 &&
    demandDominant &&
    breakoutDistancePct !== null &&
    breakoutDistancePct <= 12 &&
    breakoutDistancePct >= 2
  ) {
    return {
      phase: "Support dikunci bandar",
      bias: "Harga murah sedang dijaga di support sambil supply diserap perlahan",
      tone: "bullish" as const,
    };
  }

  if (
    isCheapStock &&
    rangeCompressed &&
    obvSlope20 > 0 &&
    adSlope20 > 0 &&
    (upDownVolumeRatio ?? 0) >= 0.98 &&
    stealthRsiZone &&
    (priceVsMa20 ?? -99) >= -4.2 &&
    (priceVsMa20 ?? 99) <= 2.2
  ) {
    return {
      phase: "Sideways akumulasi senyap",
      bias: "Harga bergerak datar, tetapi barang belum tampak dilepas agresif",
      tone: "bullish" as const,
    };
  }

  if (
    isCheapStock &&
    obvSlope20 > 0 &&
    adSlope20 > 0 &&
    (upDownVolumeRatio ?? 0) >= 1.05 &&
    (priceVsMa20 ?? -99) >= -0.8 &&
    (priceVsMa20 ?? 99) <= 4.5 &&
    breakoutDistancePct !== null &&
    breakoutDistancePct <= 8
  ) {
    return {
      phase: "Markup dini",
      bias: "Bandar mulai mendorong harga, tetapi belum terlalu jauh dari area kumpul",
      tone: "bullish" as const,
    };
  }

  if (ma20 && ma50 && price > ma20 && ma20 > ma50 && obvSlope20 > 0 && adSlope20 > 0) {
    if (breakoutDistancePct !== null && breakoutDistancePct <= 1.5 && volumeRatio < 1) {
      return { phase: "False breakout risk", bias: "Breakout dekat, tapi follow-through belum kuat", tone: "warning" as const };
    }
    if (breakoutDistancePct !== null && breakoutDistancePct <= 3 && volumeRatio >= 1.1) {
      return { phase: "Akumulasi menuju markup", bias: "Bandar cenderung akumulasi agresif", tone: "bullish" as const };
    }
    return { phase: "Markup sehat", bias: "Tenaga naik masih dominan", tone: "bullish" as const };
  }

  if (ma20 && ma50 && nearMa20 && aboveMa50 && obvSlope20 > 0 && adSlope20 > 0 && demandDominant && inHealthyRsiZone) {
    return { phase: "Trend pullback sehat", bias: "Supply ditekan ringan, demand masih menjaga struktur", tone: "bullish" as const };
  }

  if (
    nearMa20 &&
    nearBreakout &&
    obvSlope20 > 0 &&
    adSlope20 > 0 &&
    demandDominant &&
    (priceVsMa20 ?? 99) <= 0.8 &&
    (priceVsMa20 ?? -99) >= -2.8 &&
    (rsi ?? 0) >= 38 &&
    (rsi ?? 100) <= 60
  ) {
    return {
      phase: "Akumulasi di support",
      bias: "Support ditahan sambil ada indikasi smart money menyerap supply",
      tone: "bullish" as const,
    };
  }

  if (ma20 && ma50 && price < ma20 && ma20 < ma50 && obvSlope20 < 0 && adSlope20 < 0) {
    return { phase: "Markdown / distribusi lanjut", bias: "Distribusi masih dominan", tone: "bearish" as const };
  }

  if (nearMa20 && rangeCompressed && obvSlope20 > 0 && adSlope20 > 0 && inHealthyRsiZone) {
    return { phase: "Base building", bias: "Ada fase bangun base sebelum dorongan berikutnya", tone: "neutral" as const };
  }

  if (priceVsMa20 !== null && priceVsMa20 > 0 && priceVsMa50 !== null && priceVsMa50 <= 0 && obvSlope20 > 0 && demandDominant) {
    return { phase: "Reclaim awal", bias: "Demand mulai merebut kembali struktur menengah", tone: "neutral" as const };
  }

  if (obvSlope20 > 0 && adSlope20 > 0) {
    return { phase: "Akumulasi dalam range", bias: "Ada indikasi serap barang diam-diam", tone: "neutral" as const };
  }

  if (obvSlope20 < 0 && adSlope20 < 0) {
    return { phase: "Distribusi dalam range", bias: "Supply masih lebih berat dari demand", tone: "warning" as const };
  }

  return { phase: "Netral / transisi", bias: "Belum ada jejak bandar yang dominan", tone: "neutral" as const };
}

function formatPct(value: number | null, digits = 2) {
  return value == null ? "-" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatRatio(value: number | null, digits = 2) {
  return value == null ? "-" : `${value.toFixed(digits)}x`;
}

function uniqueRoundedLevels(values: number[]) {
  return Array.from(new Set(values.map((value) => Math.round(value)))).filter((value) => value > 0);
}

function sortSupports(values: number[], price: number) {
  return uniqueRoundedLevels(values)
    .filter((value) => value < price)
    .sort((left, right) => right - left);
}

function sortResistances(values: number[], price: number) {
  return uniqueRoundedLevels(values)
    .filter((value) => value > price)
    .sort((left, right) => left - right);
}

export async function analyzeBandarmology(input: string): Promise<BandarmologyAnalysisResult> {
  const normalizedInput = input.trim().toUpperCase();
  if (!normalizedInput) {
    throw new Error("Ticker wajib diisi");
  }

  const searchResults = await searchStocks(normalizedInput);
  const matched =
    searchResults.find((item) => item.symbol.replace(".JK", "").toUpperCase() === normalizedInput.replace(".JK", "")) ||
    searchResults[0];

  if (!matched) {
    throw new Error("Ticker tidak ditemukan di IDX");
  }

  return analyzeBandarmologyTicker(matched.symbol, matched.name);
}

export async function analyzeBandarmologyTicker(ticker: string, nameHint?: string): Promise<BandarmologyAnalysisResult> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    throw new Error("Ticker wajib diisi");
  }

  const [quote, history] = await Promise.all([
    getQuote(normalizedTicker),
    getHistory(
      normalizedTicker,
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      undefined,
      "1d"
    ),
  ]);

  if (!quote || history.length < 40) {
    throw new Error("Data harga/volume belum cukup untuk analisa bandarmology");
  }

  const bars = history as OHLCVBar[];
  const technical = calcTechnicalSignals(bars);
  const recent20 = bars.slice(-20);
  const recent10 = bars.slice(-10);
  const recent5 = bars.slice(-5);
  const recent60 = bars.slice(-60);
  const highs20 = recent20.map((bar) => bar.high);
  const highest20 = Math.max(...highs20);
  const lowest20 = Math.min(...recent20.map((bar) => bar.low));
  const recentRangePct = highest20 > 0 ? ((highest20 - lowest20) / highest20) * 100 : null;

  const obv = computeObv(bars);
  const adLine = computeADLine(bars);

  const avgVol5 = mean(recent5.map((bar) => bar.volume));
  const avgVol20 = mean(recent20.map((bar) => bar.volume));
  const volumeRatio5v20 = avgVol20 > 0 ? avgVol5 / avgVol20 : null;

  const upVolume = recent20.filter((bar, index) => index > 0 && bar.close >= recent20[index - 1].close).reduce((sum, bar) => sum + bar.volume, 0);
  const downVolume = recent20.filter((bar, index) => index > 0 && bar.close < recent20[index - 1].close).reduce((sum, bar) => sum + bar.volume, 0);
  const upDownVolumeRatio = downVolume > 0 ? upVolume / downVolume : null;

  const breakoutDistancePct = highest20 > 0 ? ((highest20 - quote.price) / highest20) * 100 : null;
  const priceVsMa20 = technical.ma20 ? ((quote.price - technical.ma20) / technical.ma20) * 100 : null;
  const priceVsMa50 = technical.ma50 ? ((quote.price - technical.ma50) / technical.ma50) * 100 : null;
  const obvSlope20 = slope(obv.slice(-20));
  const adSlope20 = slope(adLine.slice(-20));

  const phaseInfo = classifyPhase({
    price: quote.price,
    ma20: technical.ma20,
    ma50: technical.ma50,
    obvSlope20,
    adSlope20,
    breakoutDistancePct,
    volumeRatio: volumeRatio5v20 ?? 1,
    priceVsMa20,
    priceVsMa50,
    rsi: technical.rsi,
    upDownVolumeRatio,
    recentRangePct,
  });

  let conviction = 50;
  if (technical.score >= 60) conviction += 10;
  if ((upDownVolumeRatio ?? 1) > 1.15) conviction += 10;
  if (obvSlope20 > 0) conviction += 10;
  if (adSlope20 > 0) conviction += 10;
  if ((breakoutDistancePct ?? 99) <= 3) conviction += 5;
  if (phaseInfo.phase === "Support dikunci bandar") conviction += 10;
  if (phaseInfo.phase === "Sideways akumulasi senyap") conviction += 8;
  if (phaseInfo.phase === "Markup dini") conviction += 8;
  if (phaseInfo.phase === "Trend pullback sehat") conviction += 6;
  if (phaseInfo.phase === "Akumulasi di support") conviction += 7;
  if (phaseInfo.phase === "Base building") conviction += 4;
  if (phaseInfo.phase === "Reclaim awal") conviction += 4;
  if (phaseInfo.phase === "False breakout risk") conviction -= 12;
  if ((volumeRatio5v20 ?? 1) < 0.8 && phaseInfo.tone === "bullish") conviction -= 5;
  if (phaseInfo.tone === "bearish") conviction -= 20;
  conviction = clamp(conviction, 10, 95);

  const pullbackLightVolume =
    mean(recent10.filter((bar, index) => index > 0 && bar.close < recent10[index - 1].close).map((bar) => bar.volume)) <
    mean(recent10.filter((bar, index) => index > 0 && bar.close >= recent10[index - 1].close).map((bar) => bar.volume));

  let actionBias = "Tunggu konfirmasi demand sebelum agresif";
  if (phaseInfo.tone === "bullish") {
    actionBias =
      breakoutDistancePct !== null && breakoutDistancePct <= 2.5
        ? "Siapkan skenario buy on breakout / buy on weakness"
        : "Pantau pullback sehat untuk entry bertahap";
    if (phaseInfo.phase === "Support dikunci bandar" || phaseInfo.phase === "Akumulasi di support") {
      actionBias = "Support sedang dijaga; entry bertahap dekat support lebih menarik daripada menunggu breakout terlambat";
    } else if (phaseInfo.phase === "Sideways akumulasi senyap") {
      actionBias = "Cocok untuk posisi observasi aktif atau cicil kecil selama range tidak rusak dan supply tetap kalem";
    } else if (phaseInfo.phase === "Markup dini") {
      actionBias = "Jangan kejar terlalu tinggi; manfaatkan pullback tipis atau retest agar ikut fase markup sejak awal";
    }
  } else if (phaseInfo.phase === "Base building") {
    actionBias = "Fokus observasi base; tunggu demand tetap konsisten atau breakout kecil sebelum entry agresif";
  } else if (phaseInfo.phase === "Reclaim awal") {
    actionBias = "Pantau retest area reclaim; jika bertahan, kandidat bisa naik kelas dari observasi ke entry bertahap";
  } else if (phaseInfo.phase === "False breakout risk") {
    actionBias = "Jangan kejar breakout tipis; tunggu retest valid atau volume lanjutan yang lebih meyakinkan";
  } else if (phaseInfo.tone === "bearish") {
    actionBias = "Utamakan defensif, hindari asumsi bottom tanpa konfirmasi volume";
  }

  const rawSupports = technical.srLevels.filter((level) => level.type === "S").map((level) => level.price);
  const rawResistances = technical.srLevels.filter((level) => level.type === "R").map((level) => level.price);
  const reclaimedResistanceSupports = rawResistances.filter((level) => level < quote.price);
  const pendingSupportOverhead = rawSupports.filter((level) => level > quote.price);
  const breakoutHasTriggered = quote.price > highest20;
  const breakoutBufferPct = highest20 > 0 ? ((quote.price - highest20) / highest20) * 100 : null;
  const breakoutVolumeConfirmed = (volumeRatio5v20 ?? 0) >= 1.1;
  const breakoutNeedsConfirmation = breakoutDistancePct !== null && breakoutDistancePct <= 3;
  const potentialFalseBreakout =
    breakoutHasTriggered
      ? !breakoutVolumeConfirmed || (quote.price < highest20 * 1.01 && technical.rsi !== null && technical.rsi > 74)
      : breakoutNeedsConfirmation && !breakoutVolumeConfirmed;

  const supports = sortSupports(
    [
      ...rawSupports,
      ...reclaimedResistanceSupports,
      lowest20,
      technical.ma20 ?? 0,
      technical.ma50 ?? 0,
    ],
    quote.price
  ).slice(0, 3);

  const resistances = sortResistances(
    [
      ...rawResistances,
      ...pendingSupportOverhead,
      highest20,
      breakoutHasTriggered && breakoutBufferPct !== null ? quote.price * 1.03 : 0,
      breakoutHasTriggered && breakoutBufferPct !== null ? quote.price * 1.06 : 0,
    ],
    quote.price
  ).slice(0, 3);

  const primaryResistance = resistances[0] ?? (highest20 > quote.price ? Math.round(highest20) : null);
  const primarySupport = supports[0] ?? null;
  const supportDistancePct =
    primarySupport && primarySupport > 0 ? ((quote.price - primarySupport) / primarySupport) * 100 : null;
  const resistanceUpsidePct =
    primaryResistance && quote.price > 0 ? ((primaryResistance - quote.price) / quote.price) * 100 : null;
  const closes60 = recent60.map((bar) => bar.close);
  const ma20Series = smaSeries(closes60, 20);
  const ma50Series = smaSeries(closes60, 50);
  const chartAnnotations = [
    supports[0]
      ? {
          key: "support",
          label: "Support",
          detail: "Area jaga demand. Jika ini patah, skenario akumulasi melemah.",
          value: supports[0],
          color: "#6ee7b7",
        }
      : null,
    resistances[0]
      ? {
          key: "resistance",
          label: "Resistance",
          detail: "Area supply terdekat. Breakout valid butuh dorongan volume.",
          value: resistances[0],
          color: "#fca5a5",
        }
      : null,
    highest20
      ? {
          key: "breakout",
          label: "Area Breakout",
          detail: breakoutHasTriggered
            ? (potentialFalseBreakout
                ? "Breakout sudah terjadi, tetapi follow-through masih rawan false breakout bila volume melemah."
                : "Breakout sudah terlewati. Area ini sekarang idealnya berubah fungsi menjadi support baru.")
            : breakoutDistancePct !== null && breakoutDistancePct <= 3
              ? "Harga sudah dekat area konfirmasi. Perhatikan follow-through dan dukungan volume."
              : "Masih perlu dorongan ke high 20 hari untuk konfirmasi markup.",
          value: highest20,
          color: "#fdba74",
        }
      : null,
    {
      key: "price",
      label: "Harga Kini",
      detail: phaseInfo.tone === "bullish"
        ? "Harga sudah masuk struktur yang lebih sehat dibanding fase distribusi."
        : phaseInfo.tone === "bearish"
          ? "Harga kini masih butuh bukti demand sebelum dianggap aman."
          : "Harga masih di area transisi, jadi konfirmasi berikutnya penting.",
      value: quote.price,
      color: "#93c5fd",
    },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    ticker: normalizedTicker,
    name: nameHint || quote.name,
    quote: {
      price: quote.price,
      changePercent: quote.changePercent,
      volume: quote.volume,
    },
    summary: {
      phase: phaseInfo.phase,
      operatorBias: phaseInfo.bias,
      conviction,
      actionBias,
      tone: phaseInfo.tone,
    },
    metrics: {
      priceVsMa20,
      priceVsMa50,
      rsi: technical.rsi,
      technicalScore: technical.score,
      volumeRatio5v20,
      upDownVolumeRatio,
      obvSlope20,
      adSlope20,
      breakoutDistancePct,
      support: supports,
      resistance: resistances,
    },
    sections: {
      overview: `${normalizedTicker.replace(".JK", "")} sedang berada pada fase "${phaseInfo.phase}". Harga ${formatPct(priceVsMa20)} vs MA20 dan ${formatPct(priceVsMa50)} vs MA50, dengan skor teknikal ${technical.score}/100. Ini memberi konteks awal apakah pergerakan saham didorong demand sehat atau hanya pantulan jangka pendek.`,
      accumulationDistribution: phaseInfo.phase === "Support dikunci bandar"
        ? `Harga sedang dekat support dan belum dijatuhkan, sementara rasio volume naik/turun ${upDownVolumeRatio?.toFixed(2) || "-"}x serta OBV 20 hari masih menanjak. Dalam filosofi Cerita Saham, ini lebih menarik karena menunjukkan saham murah yang kemungkinan sedang dipelihara, bukan sekadar menunggu breakout yang sudah telat.`
        : phaseInfo.phase === "Sideways akumulasi senyap"
          ? `Harga tampak sideways dan tidak heboh, tetapi OBV/A-D line belum ikut melemah. Ini cocok dengan pola akumulasi diam-diam: bandar belum perlu mengerek harga dulu, cukup serap supply sambil menjaga range tetap tenang.`
          : phaseInfo.tone === "bullish"
        ? `Dari sisi price-volume, jejak akumulasi terlihat lebih dominan. Rasio volume naik/turun ${upDownVolumeRatio?.toFixed(2) || "-"}x dan OBV 20 hari cenderung naik. Ini selaras dengan pendekatan bandarmology yang mencari tanda barang diserap saat range atau pullback.`
        : phaseInfo.tone === "bearish"
          ? `Jejak distribusi lebih terasa. OBV dan A/D line 20 hari sama-sama melemah, artinya kenaikan yang muncul belum cukup menunjukkan penyerapan supply. Dalam kacamata bandarmology, ini lebih dekat ke fase lepas barang daripada kumpul barang.`
          : phaseInfo.phase === "Base building"
            ? `Harga sedang membangun base yang lebih rapi. Range 20 hari sekitar ${formatPct(recentRangePct)} dan OBV/A-D line masih condong positif, jadi ini lebih cocok dibaca sebagai fase menata tenaga sebelum markup, bukan sekadar sideways tanpa arah.`
            : `Belum ada dominasi akumulasi atau distribusi yang benar-benar bersih. Volume dan struktur harga masih campuran, sehingga admin sebaiknya menunggu bukti tambahan sebelum memberi bias kuat.`,
      operatorFootprint: phaseInfo.phase === "Support dikunci bandar"
        ? `Harga sedang relatif dekat area support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "terdekat"} dan belum dijebol, sementara OBV/A-D line masih menanjak. Ini lebih cocok dibaca sebagai support yang sedang dikunci sambil supply diserap, jadi ada peluang markup ke resistance tanpa harus menunggu candle breakout dulu.`
        : phaseInfo.phase === "Sideways akumulasi senyap"
          ? `Pergerakan harga masih kelihatan membosankan, tetapi justru itu yang sering dicari dalam gaya Cerita Saham. Selama volume tidak menunjukkan distribusi besar dan aliran akumulasi tetap bertahan, sideways seperti ini bisa menjadi area parkir bandar sebelum gerak berikutnya.`
        : pullbackLightVolume
        ? `Pullback terakhir cenderung terjadi dengan volume lebih ringan dibanding hari-hari naik. Dalam kerangka Cerita Saham, ini sering dibaca sebagai koreksi sehat, karena tekanan jual tidak terlalu agresif dan barang tidak dibuang besar-besaran.`
        : phaseInfo.phase === "Akumulasi di support"
          ? `Harga sedang relatif dekat area support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "terdekat"} dan belum dijebol, sementara OBV/A-D line masih menanjak. Ini lebih cocok dibaca sebagai support yang sedang dikunci sambil supply diserap diam-diam, bukan sekadar sideways pasif.`
        : phaseInfo.phase === "False breakout risk"
          ? `Harga memang terlihat dekat atau sempat melewati area pecah, tetapi jejak operator belum rapi karena follow-through volume belum solid. Ini sering menjadi ciri false breakout: harga tampak kuat sebentar, lalu cepat kehilangan tenaga.`
          : `Pullback tidak cukup ringan, atau hari-hari turun masih membawa volume yang cukup besar. Itu berarti jejak bandar belum sepenuhnya bersih dari distribusi jangka pendek, sehingga entry agresif sebaiknya ditahan dulu.`,
      ryanFilbertLens: `Lensa Cerita Saham menaruh perhatian lebih besar pada saham murah yang sedang dijaga di support, sideways rapi sambil akumulasi, atau mulai masuk markup dini. Fokusnya bukan mencari saham paling aman atau paling trend-following, tetapi mencari jejak supply-demand yang menunjukkan bandar belum selesai kumpul barang dan masih punya alasan mendorong harga dalam waktu dekat.`,
      executionPlan: phaseInfo.tone === "bullish"
        ? breakoutHasTriggered
          ? `Rencana eksekusi: karena harga sudah melewati area breakout ${Math.round(highest20).toLocaleString("id-ID")}, fokus berikutnya adalah menjaga area itu sebagai support baru. Entry tambahan lebih aman saat pullback tertahan di support ${supports[0] ? supports[0].toLocaleString("id-ID") : "terdekat"} atau saat harga melanjutkan gerak ke target resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "berikutnya"} dengan volume tetap sehat.`
          : phaseInfo.phase === "Support dikunci bandar" || phaseInfo.phase === "Akumulasi di support"
            ? `Rencana eksekusi: support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "terdekat"} sedang relatif dijaga sambil ada jejak akumulasi. Ini membuat skenario cicil entry dekat support menjadi valid selama harga tetap tertahan dan volume jual tidak membesar. Target awalnya adalah dorongan ke resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "terdekat"}${resistanceUpsidePct != null ? ` dengan upside sekitar ${resistanceUpsidePct.toFixed(2)}%` : ""}. Breakout tetap penting, tetapi dalam fase ini breakout lebih cocok dipakai sebagai konfirmasi add-on, bukan satu-satunya trigger entry.`
            : phaseInfo.phase === "Sideways akumulasi senyap"
              ? `Rencana eksekusi: perlakukan range saat ini sebagai area kumpul. Selama support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "utama"} tidak rusak dan distribusi tidak membesar, entry kecil bertahap masih masuk akal untuk antisipasi markup. Target pertamanya tetap resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "terdekat"}, lalu breakout dipakai untuk menilai apakah bandar benar-benar mulai mengangkat harga.`
              : phaseInfo.phase === "Markup dini"
                ? `Rencana eksekusi: saham ini sudah masuk fase markup dini. Hindari FOMO di candle panjang; lebih ideal menunggu pullback ringan atau retest di dekat support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "terdekat"} agar posisi masih punya ruang ke resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "berikutnya"}${resistanceUpsidePct != null ? ` dengan upside sekitar ${resistanceUpsidePct.toFixed(2)}%` : ""}.`
            : `Rencana eksekusi: fokus ke area support ${supports[0] ? supports[0].toLocaleString("id-ID") : "terdekat"} untuk buy on weakness, atau tunggu breakout bersih di area ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "resistance terdekat"} dengan volume di atas rata-rata. Hindari mengejar harga jika sudah terlalu jauh dari support.`
        : phaseInfo.tone === "bearish"
          ? `Rencana eksekusi: jangan buru-buru averaging down. Tunggu demand kembali muncul di dekat support ${supports[0] ? supports[0].toLocaleString("id-ID") : "utama"} atau tunggu struktur harga memperbaiki diri di atas resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "terdekat"}. Prioritas utama tetap proteksi modal.`
          : `Rencana eksekusi: perlakukan saham ini sebagai kandidat observasi aktif. Fokus utamanya adalah mencari tanda support mulai dijaga, volume jual makin tipis, atau sideways mulai berubah menjadi akumulasi. Breakout hanyalah bonus konfirmasi, bukan satu-satunya jalan masuk.`,
      riskNotes: breakoutHasTriggered
        ? `Harga sudah berada di atas area breakout ${Math.round(highest20).toLocaleString("id-ID")}. Risiko utamanya sekarang adalah false breakout: harga gagal bertahan di atas area itu, volume lanjutan mengecil (${formatRatio(volumeRatio5v20)}), atau harga cepat kembali masuk ke bawah level pecah. Selama breakout level masih terjaga sebagai support, struktur naik tetap valid.`
        : phaseInfo.phase === "Support dikunci bandar" || phaseInfo.phase === "Akumulasi di support"
          ? `Risiko utama ada jika support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "utama"} gagal dipertahankan${supportDistancePct != null ? `, terutama karena harga saat ini hanya berjarak ${supportDistancePct.toFixed(2)}% dari level itu` : ""}. Selama support tetap dijaga dan distribusi tidak membesar, skenario dorongan ke resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "terdekat"} masih relevan.`
          : phaseInfo.phase === "Sideways akumulasi senyap"
            ? `Risiko utama pola ini adalah sideways ternyata hanya dead money, bukan parkiran bandar. Karena itu, fokuskan kontrol risiko pada area support ${primarySupport ? primarySupport.toLocaleString("id-ID") : "utama"} dan pantau apakah OBV/A-D mulai melemah. Jika support patah dan distribusi membesar, asumsi akumulasi senyap perlu dibatalkan.`
          : `Risiko utama saham ini ada pada penolakan di resistance ${primaryResistance ? primaryResistance.toLocaleString("id-ID") : "dekat harga sekarang"} dan potensi false breakout bila harga mendekati area pecah tetapi volume belum mendukung (${formatRatio(volumeRatio5v20)}). Karena aplikasi tidak memiliki broker summary asli, hasil ini harus dipakai sebagai pembacaan jejak harga-volume, bukan pengganti konfirmasi transaksi broker.`,
    },
    chart: {
      points: recent60.map((bar, index) => ({
        time: typeof bar.time === "string" ? bar.time : String(bar.time),
        close: bar.close,
        ma20: ma20Series[index],
        ma50: ma50Series[index],
      })),
      annotations: chartAnnotations,
    },
    assumptions: [
      "Analisa memakai data harga dan volume publik harian yang tersedia di aplikasi.",
      "Tidak memakai broker summary atau distribusi broker proprietary.",
      "Kerangka dibangun sebagai adaptasi bandarmology yang diarahkan ke filosofi Cerita Saham: mencari saham murah yang sedang dijaga, diakumulasi diam-diam, atau siap masuk markup dini.",
    ],
  };
}
