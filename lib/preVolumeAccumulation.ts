export type PreVolumeBar = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type PreVolumeQuote = {
  price: number;
  volume: number;
  previousClose: number;
};

export type PreVolumeAccumulation = {
  status: string;
  score: number;
  label: string;
  mode: "early" | "watch" | "active-volume" | "weak";
  setupType: "reversal" | "healthy-pullback" | "continue-to-fly" | "base-breakout" | "weak";
  reasons: string[];
  risks: string[];
  triggers: string[];
  metrics: {
    volumeRatio: number | null;
    rangeCompressionPct: number | null;
    breakoutDistancePct: number | null;
    closeNearHighDays: number;
    obvSlope20: number | null;
    adSlope20: number | null;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPrice(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return Math.round(value).toLocaleString("id-ID");
}

function formatRatio(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return `${value.toFixed(1)}x`;
}

function formatPct(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function cleanDailyBars(history: PreVolumeBar[]) {
  return history
    .filter((bar) =>
      isFiniteNumber(bar.open) &&
      isFiniteNumber(bar.high) &&
      isFiniteNumber(bar.low) &&
      isFiniteNumber(bar.close) &&
      bar.high > 0 &&
      bar.low > 0 &&
      bar.close > 0
    )
    .slice(-90);
}

function computeObv(bars: PreVolumeBar[]) {
  let current = 0;
  return bars.map((bar, index) => {
    if (index === 0) return 0;
    const prev = bars[index - 1];
    const volume = bar.volume ?? 0;
    if (bar.close > prev.close) current += volume;
    if (bar.close < prev.close) current -= volume;
    return current;
  });
}

function computeAdLine(bars: PreVolumeBar[]) {
  let current = 0;
  return bars.map((bar) => {
    const range = bar.high - bar.low;
    const multiplier = range === 0 ? 0 : ((bar.close - bar.low) - (bar.high - bar.close)) / range;
    current += multiplier * (bar.volume ?? 0);
    return current;
  });
}

function slope(values: number[]) {
  if (values.length < 2) return null;
  return values[values.length - 1] - values[0];
}

export function buildPreVolumeAccumulation(
  quote: PreVolumeQuote,
  dailyHistory: PreVolumeBar[],
): PreVolumeAccumulation {
  const bars = cleanDailyBars(dailyHistory);
  const latest = bars[bars.length - 1] ?? null;

  if (bars.length < 35 || !latest) {
    return {
      status: "Data belum cukup",
      score: 0,
      label: "Belum bisa membaca akumulasi pra-volume",
        mode: "weak",
        setupType: "weak",
        reasons: [],
      risks: ["Butuh minimal sekitar 35 candle harian untuk membaca pola akumulasi"],
      triggers: [],
      metrics: {
        volumeRatio: null,
        rangeCompressionPct: null,
        breakoutDistancePct: null,
        closeNearHighDays: 0,
        obvSlope20: null,
        adSlope20: null,
      },
    };
  }

  const price = quote.price || latest.close;
  const last20 = bars.slice(-20);
  const last5 = bars.slice(-5);
  const prev20 = bars.slice(-40, -20);
  const last10 = bars.slice(-10);
  const previousForVolume = bars.slice(-21, -1).filter((bar) => (bar.volume ?? 0) > 0);
  const avgVolume20 = average(previousForVolume.map((bar) => bar.volume ?? 0));
  const liveVolume = quote.volume > 0 ? quote.volume : latest.volume ?? 0;
  const volumeRatio = avgVolume20 && liveVolume > 0 ? liveVolume / avgVolume20 : null;
  const volumeAlreadyLarge = volumeRatio !== null && volumeRatio >= 1.5;
  const volumeStillQuiet = volumeRatio === null || volumeRatio < 1.5;

  const high20 = Math.max(...last20.map((bar) => bar.high));
  const high10 = Math.max(...last10.map((bar) => bar.high));
  const high5 = Math.max(...last5.map((bar) => bar.high));
  const low20 = Math.min(...last20.map((bar) => bar.low));
  const low10 = Math.min(...last10.map((bar) => bar.low));
  const avgClose20 = average(last20.map((bar) => bar.close)) ?? price;
  const avgClose5 = average(last5.map((bar) => bar.close)) ?? price;
  const rangeCompressionPct = avgClose20 > 0 ? ((high20 - low20) / avgClose20) * 100 : null;

  const prevRangePct = (() => {
    if (prev20.length < 10) return null;
    const high = Math.max(...prev20.map((bar) => bar.high));
    const low = Math.min(...prev20.map((bar) => bar.low));
    const close = average(prev20.map((bar) => bar.close)) ?? price;
    return close > 0 ? ((high - low) / close) * 100 : null;
  })();

  const rangeCompressed =
    rangeCompressionPct !== null &&
    (rangeCompressionPct <= 14 || (prevRangePct !== null && rangeCompressionPct <= prevRangePct * 0.72));

  const close20Ago = bars[bars.length - 21]?.close ?? last20[0]?.close ?? price;
  const priceChange20Pct = close20Ago > 0 ? ((price - close20Ago) / close20Ago) * 100 : 0;
  const priceSideways = Math.abs(priceChange20Pct) <= 8 && (rangeCompressionPct ?? 99) <= 18;

  const obv = computeObv(bars);
  const adLine = computeAdLine(bars);
  const obvSlope20 = slope(obv.slice(-20));
  const adSlope20 = slope(adLine.slice(-20));
  const obvAccumulating = (obvSlope20 ?? 0) > 0;
  const adAccumulating = (adSlope20 ?? 0) > 0;

  const downDays = last10.filter((bar, index) => {
    const prev = bars[bars.length - last10.length + index - 1];
    return prev ? bar.close < prev.close : bar.close < bar.open;
  });
  const upDays = last10.filter((bar, index) => {
    const prev = bars[bars.length - last10.length + index - 1];
    return prev ? bar.close > prev.close : bar.close > bar.open;
  });
  const avgDownVolume = average(downDays.map((bar) => bar.volume ?? 0).filter((value) => value > 0));
  const avgUpVolume = average(upDays.map((bar) => bar.volume ?? 0).filter((value) => value > 0));
  const dryPullback = avgDownVolume !== null && avgUpVolume !== null && avgDownVolume <= avgUpVolume * 0.82;

  const closeNearHighDays = last10.filter((bar) => {
    const range = bar.high - bar.low;
    if (range <= 0) return false;
    return ((bar.close - bar.low) / range) * 100 >= 62;
  }).length;
  const repeatedCloseNearHigh = closeNearHighDays >= 5;

  const low20Earlier = Math.min(...last20.slice(0, 10).map((bar) => bar.low));
  const supportHeld = low10 >= low20Earlier * 0.985 && price >= low20 * 1.02;
  const distanceFromLow20Pct = low20 > 0 ? ((price - low20) / low20) * 100 : null;

  const breakoutDistancePct = high20 > 0 ? ((high20 - price) / high20) * 100 : null;
  const nearBreakout = breakoutDistancePct !== null && breakoutDistancePct >= -1 && breakoutDistancePct <= 10;

  const lastRange = latest.high - latest.low;
  const latestClosePosition = lastRange > 0 ? ((latest.close - latest.low) / lastRange) * 100 : 50;
  const heavyDistribution =
    volumeAlreadyLarge &&
    latestClosePosition < 45 &&
    latest.close < latest.open;

  let score = 0;
  const reasons: string[] = [];
  const risks: string[] = [];

  if (volumeStillQuiet) {
    score += 12;
    reasons.push(`Volume belum ramai (${formatRatio(volumeRatio)} vs rata-rata 20D)`);
  } else {
    risks.push(`Volume sudah besar (${formatRatio(volumeRatio)}), ini bukan fase paling awal`);
  }

  if (rangeCompressed) {
    score += 15;
    reasons.push(`Range 20D menyempit (${formatPct(rangeCompressionPct)})`);
  }

  if (priceSideways) {
    score += 10;
    reasons.push(`Harga masih sideways (${formatPct(priceChange20Pct)} dalam 20D)`);
  }

  if (obvAccumulating && adAccumulating) {
    score += 18;
    reasons.push("OBV dan A/D naik saat harga belum meledak");
  } else if (obvAccumulating || adAccumulating) {
    score += 9;
    reasons.push(`${obvAccumulating ? "OBV" : "A/D"} mulai naik`);
  } else {
    risks.push("OBV/A-D belum menunjukkan akumulasi bersih");
  }

  if (dryPullback) {
    score += 12;
    reasons.push("Pullback cenderung kering, supply turun tidak agresif");
  }

  if (repeatedCloseNearHigh) {
    score += 10;
    reasons.push(`${closeNearHighDays}/10 candle terakhir close dekat high`);
  }

  if (supportHeld) {
    score += 13;
    reasons.push(`Support 20D sekitar ${formatPrice(low20)} masih dijaga`);
  } else if (price < low20 * 1.01) {
    risks.push(`Harga terlalu dekat support bawah ${formatPrice(low20)}`);
  }

  if (nearBreakout) {
    score += 10;
    reasons.push(`Jarak ke high 20D tinggal ${formatPct(Math.max(0, breakoutDistancePct ?? 0))}`);
  }

  if (heavyDistribution) {
    score -= 25;
    risks.push("Volume besar muncul tetapi close lemah, rawan distribusi");
  }

  if (price < quote.previousClose && quote.previousClose > 0) {
    score -= 6;
    risks.push(`Harga masih di bawah prev close ${formatPrice(quote.previousClose)}`);
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const mode: PreVolumeAccumulation["mode"] = volumeAlreadyLarge && finalScore >= 60
    ? "active-volume"
    : finalScore >= 75
      ? "early"
      : finalScore >= 55
        ? "watch"
        : "weak";

  const status =
    mode === "early"
      ? "Akumulasi kuat pra-volume"
      : mode === "watch"
        ? "Mulai menarik, tunggu trigger"
        : mode === "active-volume"
          ? "Volume sudah mulai besar"
          : "Belum ada akumulasi jelas";

  const label =
    mode === "early"
      ? "Potensi markup dini sebelum ramai"
      : mode === "watch"
        ? "Watchlist, tunggu close/volume konfirmasi"
        : mode === "active-volume"
          ? "Sudah bukan fase sebelum volume"
          : "Belum layak disebut pra-markup";

  const setupType: PreVolumeAccumulation["setupType"] = finalScore < 45
    ? "weak"
    : distanceFromLow20Pct !== null &&
      distanceFromLow20Pct <= 8 &&
      priceChange20Pct <= -3 &&
      (obvAccumulating || adAccumulating)
      ? "reversal"
      : priceChange20Pct >= 4 &&
        dryPullback &&
        supportHeld &&
        price < high20 * 0.985
        ? "healthy-pullback"
        : breakoutDistancePct !== null &&
          breakoutDistancePct <= 3.5 &&
          repeatedCloseNearHigh &&
          !heavyDistribution
          ? "continue-to-fly"
          : "base-breakout";

  const earlyTriggerBase =
    setupType === "reversal"
      ? Math.max(high5, quote.previousClose || 0, price * 1.015)
      : setupType === "healthy-pullback"
        ? Math.max(high5, avgClose5, price * 1.012)
        : setupType === "continue-to-fly"
          ? Math.max(high10, high20)
          : Math.max(high10, price * 1.02);
  const earlyTrigger = setupType === "continue-to-fly"
    ? earlyTriggerBase
    : Math.min(earlyTriggerBase, price * 1.045);
  const triggerDistancePct = price > 0 ? ((earlyTrigger - price) / price) * 100 : null;
  const invalidationLevel =
    setupType === "reversal"
      ? Math.min(low10, low20)
      : setupType === "healthy-pullback"
        ? Math.max(low10, low20)
        : setupType === "continue-to-fly"
          ? Math.max(low10, price * 0.965)
          : low20;

  const setupLabel =
    setupType === "reversal"
      ? "Reversal awal"
      : setupType === "healthy-pullback"
        ? "Pullback sehat"
        : setupType === "continue-to-fly"
          ? "Continue to fly"
          : setupType === "base-breakout"
            ? "Base breakout"
            : "Belum jelas";

  const triggers = [
    `Setup: ${setupLabel}`,
    `Valid awal jika close > ${formatPrice(earlyTrigger)} (${formatPct(triggerDistancePct)} dari harga sekarang)`,
    high20 > earlyTrigger * 1.035
      ? `Valid lanjut jika mendekati/tembus high 20D ${formatPrice(high20)}`
      : `Valid lanjut jika volume naik bertahap tanpa rejection besar`,
    `Batal jika close < ${formatPrice(invalidationLevel)} atau OBV/A-D berbalik turun`,
  ];

  return {
    status,
    score: finalScore,
    label,
    mode,
    setupType,
    reasons: reasons.slice(0, 4),
    risks: risks.slice(0, 3),
    triggers,
    metrics: {
      volumeRatio,
      rangeCompressionPct,
      breakoutDistancePct,
      closeNearHighDays,
      obvSlope20,
      adSlope20,
    },
  };
}
