// Technical Signals Engine
// Computes RSI, MACD, Moving Averages, and produces a more context-aware
// conclusion so strong momentum is not automatically treated as a fresh buy.

export interface OHLCVBar {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalItem {
  name: string;
  value: string;
  signal: "buy" | "sell" | "neutral";
  weight: number;
}

export interface TechnicalResult {
  label: "BUY" | "SELL" | "WAIT";
  score: number;
  signals: SignalItem[];
  actionBias: "entry" | "wait-pullback" | "avoid" | "risk-reward";
  conclusionTitle: string;
  conclusionBody: string;
  rsi: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  ma5: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  srLevels: { type: "R" | "S"; price: number; strength: number }[];
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev: number | null = null;

  for (const v of values) {
    if (prev === null) {
      if (result.length < period - 1) {
        result.push(Number.NaN);
        continue;
      }
      const slice = values.slice(0, period);
      prev = slice.reduce((a, b) => a + b, 0) / period;
      result.push(prev);
    } else {
      prev = v * k + prev * (1 - k);
      result.push(prev);
    }
  }

  return result;
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    return values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  const slice = closes.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number | null; signal: number | null; hist: number | null } {
  if (closes.length < slow + signal) {
    return { macd: null, signal: null, hist: null };
  }

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => (
    Number.isNaN(v) || Number.isNaN(emaSlow[i]) ? Number.NaN : v - emaSlow[i]
  ));
  const validMacd = macdLine.filter((v) => !Number.isNaN(v));
  if (validMacd.length < signal) {
    return { macd: null, signal: null, hist: null };
  }

  const signalLine = ema(validMacd, signal);
  const lastMacd = validMacd[validMacd.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];

  return {
    macd: lastMacd,
    signal: lastSignal,
    hist: lastMacd - lastSignal,
  };
}

function calcSR(bars: OHLCVBar[]): { type: "R" | "S"; price: number; strength: number }[] {
  if (bars.length < 10) return [];

  const window = bars.slice(-60);
  const levels: { price: number; type: "R" | "S"; touches: number }[] = [];
  const tolerance = 0.005;

  for (let i = 2; i < window.length - 2; i++) {
    const bar = window[i];

    if (
      bar.high > window[i - 1].high &&
      bar.high > window[i - 2].high &&
      bar.high > window[i + 1].high &&
      bar.high > window[i + 2].high
    ) {
      const existing = levels.find(
        (l) => l.type === "R" && Math.abs(l.price - bar.high) / bar.high < tolerance
      );
      if (existing) existing.touches++;
      else levels.push({ price: bar.high, type: "R", touches: 1 });
    }

    if (
      bar.low < window[i - 1].low &&
      bar.low < window[i - 2].low &&
      bar.low < window[i + 1].low &&
      bar.low < window[i + 2].low
    ) {
      const existing = levels.find(
        (l) => l.type === "S" && Math.abs(l.price - bar.low) / bar.low < tolerance
      );
      if (existing) existing.touches++;
      else levels.push({ price: bar.low, type: "S", touches: 1 });
    }
  }

  return levels
    .sort((a, b) => b.touches - a.touches)
    .slice(0, 6)
    .map((l) => ({
      type: l.type,
      price: Math.round(l.price),
      strength: Math.min(l.touches * 25, 100),
    }));
}

export function calcTechnicalSignals(bars: OHLCVBar[]): TechnicalResult {
  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const sma5arr = sma(closes, 5);
  const sma20arr = sma(closes, 20);
  const sma50arr = sma(closes, 50);
  const sma200arr = sma(closes, 200);
  const ma5 = sma5arr[sma5arr.length - 1] ?? null;
  const ma20 = sma20arr[sma20arr.length - 1] ?? null;
  const ma50 = sma50arr[sma50arr.length - 1] ?? null;
  const ma200 = sma200arr[sma200arr.length - 1] ?? null;
  const lastClose = closes[closes.length - 1];

  const rsi = calcRSI(closes);
  const { macd: macdLine, signal: macdSignal, hist: macdHist } = calcMACD(closes);

  const avgVol5 = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  const lastVol = volumes[volumes.length - 1];
  const volSpike = avgVol5 > 0 ? lastVol / avgVol5 : 1;

  const srLevels = calcSR(bars);
  const resistanceLevels = srLevels
    .filter((level) => level.type === "R" && level.price >= lastClose)
    .sort((a, b) => a.price - b.price);
  const supportLevels = srLevels
    .filter((level) => level.type === "S" && level.price <= lastClose)
    .sort((a, b) => b.price - a.price);
  const nearestResistance = resistanceLevels[0] ?? null;
  const nearestSupport = supportLevels[0] ?? null;
  const extensionFromMa20 = ma20 && ma20 > 0 ? ((lastClose - ma20) / ma20) * 100 : null;
  const distanceToResistance = nearestResistance
    ? ((nearestResistance.price - lastClose) / lastClose) * 100
    : null;
  const distanceToSupport = nearestSupport
    ? ((lastClose - nearestSupport.price) / lastClose) * 100
    : null;

  const signals: SignalItem[] = [];

  if (ma20 !== null && ma50 !== null) {
    const prev20 = sma20arr[sma20arr.length - 2] ?? ma20;
    const prev50 = sma50arr[sma50arr.length - 2] ?? ma50;

    if (ma20 > ma50 && prev20 <= prev50) {
      signals.push({ name: "Golden Cross", value: "MA20 > MA50", signal: "buy", weight: 25 });
    } else if (ma20 < ma50 && prev20 >= prev50) {
      signals.push({ name: "Death Cross", value: "MA20 < MA50", signal: "sell", weight: 25 });
    } else if (ma20 > ma50) {
      signals.push({
        name: "Trend MA",
        value: `MA20 (${ma20.toFixed(0)}) > MA50 (${ma50.toFixed(0)})`,
        signal: "buy",
        weight: 15,
      });
    } else {
      signals.push({
        name: "Trend MA",
        value: `MA20 (${ma20.toFixed(0)}) < MA50 (${ma50.toFixed(0)})`,
        signal: "sell",
        weight: 15,
      });
    }
  }

  if (ma200 !== null) {
    if (lastClose > ma200) {
      signals.push({
        name: "Above MA200",
        value: `Harga di atas MA200 (${ma200.toFixed(0)})`,
        signal: "buy",
        weight: 15,
      });
    } else {
      signals.push({
        name: "Below MA200",
        value: `Harga di bawah MA200 (${ma200.toFixed(0)})`,
        signal: "sell",
        weight: 15,
      });
    }
  }

  if (rsi !== null) {
    if (rsi < 30) {
      signals.push({ name: "RSI Oversold", value: `RSI ${rsi.toFixed(1)} (< 30)`, signal: "buy", weight: 20 });
    } else if (rsi > 80) {
      signals.push({ name: "RSI Sangat Panas", value: `RSI ${rsi.toFixed(1)} (> 80)`, signal: "sell", weight: 28 });
    } else if (rsi > 70) {
      signals.push({ name: "RSI Overbought", value: `RSI ${rsi.toFixed(1)} (> 70)`, signal: "sell", weight: 20 });
    } else if (rsi >= 45 && rsi <= 60) {
      signals.push({ name: "RSI Normal", value: `RSI ${rsi.toFixed(1)}`, signal: "neutral", weight: 0 });
    } else if (rsi > 60) {
      signals.push({ name: "RSI Bullish", value: `RSI ${rsi.toFixed(1)}`, signal: "buy", weight: 10 });
    } else {
      signals.push({ name: "RSI Bearish", value: `RSI ${rsi.toFixed(1)}`, signal: "sell", weight: 10 });
    }
  }

  if (macdLine !== null && macdSignal !== null) {
    if (macdHist !== null && macdHist > 0) {
      signals.push({
        name: "MACD Bullish",
        value: `MACD (${macdLine.toFixed(2)}) > Signal (${macdSignal.toFixed(2)})`,
        signal: "buy",
        weight: 20,
      });
    } else {
      signals.push({
        name: "MACD Bearish",
        value: `MACD (${macdLine.toFixed(2)}) < Signal (${macdSignal.toFixed(2)})`,
        signal: "sell",
        weight: 20,
      });
    }
  }

  if (volSpike > 2) {
    signals.push({ name: "Volume Spike", value: `Volume ${volSpike.toFixed(1)}x rata-rata`, signal: "buy", weight: 10 });
  }

  if (ma5 !== null) {
    if (lastClose > ma5) {
      signals.push({ name: "Momentum", value: `Harga di atas MA5 (${ma5.toFixed(0)})`, signal: "buy", weight: 10 });
    } else {
      signals.push({ name: "Momentum", value: `Harga di bawah MA5 (${ma5.toFixed(0)})`, signal: "sell", weight: 10 });
    }
  }

  if (extensionFromMa20 !== null) {
    if (extensionFromMa20 >= 15) {
      signals.push({
        name: "Terlalu Jauh dari MA20",
        value: `Harga ${extensionFromMa20.toFixed(1)}% di atas MA20 (${ma20?.toFixed(0)})`,
        signal: "sell",
        weight: 24,
      });
    } else if (extensionFromMa20 >= 8) {
      signals.push({
        name: "Sudah Lari dari Area Entry",
        value: `Harga ${extensionFromMa20.toFixed(1)}% di atas MA20 (${ma20?.toFixed(0)})`,
        signal: "sell",
        weight: 14,
      });
    } else if (extensionFromMa20 <= -8) {
      signals.push({
        name: "Jauh di Bawah MA20",
        value: `Harga ${Math.abs(extensionFromMa20).toFixed(1)}% di bawah MA20 (${ma20?.toFixed(0)})`,
        signal: "sell",
        weight: 12,
      });
    }
  }

  if (distanceToResistance !== null) {
    if (distanceToResistance <= 4) {
      signals.push({
        name: "Mepet Resistance",
        value: `Resistance terdekat tinggal ${distanceToResistance.toFixed(1)}% di atas harga`,
        signal: "sell",
        weight: 18,
      });
    } else if (distanceToResistance >= 12) {
      signals.push({
        name: "Ruang ke Resistance Masih Luas",
        value: `Resistance terdekat masih ${distanceToResistance.toFixed(1)}% di atas harga`,
        signal: "buy",
        weight: 8,
      });
    }
  }

  if (distanceToSupport !== null && distanceToSupport >= 12) {
    signals.push({
      name: "Jauh dari Support",
      value: `Harga sudah ${distanceToSupport.toFixed(1)}% di atas support terdekat`,
      signal: "sell",
      weight: 10,
    });
  }

  let totalWeight = 0;
  let buyWeight = 0;
  for (const s of signals) {
    if (s.signal !== "neutral") {
      totalWeight += s.weight;
      if (s.signal === "buy") buyWeight += s.weight;
    }
  }

  const score = totalWeight > 0 ? Math.round((buyWeight / totalWeight) * 100) : 50;
  const label: "BUY" | "SELL" | "WAIT" = score >= 62 ? "BUY" : score <= 38 ? "SELL" : "WAIT";

  let actionBias: TechnicalResult["actionBias"] = "risk-reward";
  let conclusionTitle = "Sinyal teknikal masih campuran";
  let conclusionBody =
    "Tren dan momentum perlu dibaca bersama kualitas area entry. Tunggu harga masuk ke zona yang lebih enak atau muncul konfirmasi baru sebelum agresif.";

  const isOverheated =
    (rsi !== null && rsi >= 78) ||
    (extensionFromMa20 !== null && extensionFromMa20 >= 12) ||
    (distanceToResistance !== null && distanceToResistance <= 4);
  const hasBullTrend =
    label === "BUY" &&
    ma20 !== null &&
    ma50 !== null &&
    ma20 > ma50 &&
    macdHist !== null &&
    macdHist > 0;

  if (label === "SELL") {
    actionBias = "avoid";
    conclusionTitle = "Struktur teknikal masih lemah";
    conclusionBody =
      "Tekanan jual masih lebih dominan daripada demand sehat. Fokus jaga risiko dulu dan tunggu struktur membaik sebelum mempertimbangkan entry.";
  } else if (hasBullTrend && isOverheated) {
    actionBias = "wait-pullback";
    conclusionTitle = "Tren kuat, tapi entry sudah terlalu tinggi";
    conclusionBody =
      "Beberapa indikator memang bullish, tetapi itu juga menandakan harga sudah memanas. Skenario yang lebih sehat adalah menunggu pullback, konsolidasi, atau retest support terdekat daripada mengejar harga.";
  } else if (label === "BUY") {
    actionBias = "entry";
    conclusionTitle = "Teknikal mendukung entry bertahap";
    conclusionBody =
      "Tren, momentum, dan ruang gerak masih cukup sehat. Tetap perhatikan support terdekat agar entry tidak dilakukan terlalu jauh dari area jaga risikonya.";
  } else if (isOverheated) {
    actionBias = "wait-pullback";
    conclusionTitle = "Momentum ada, tapi risk-reward kurang menarik";
    conclusionBody =
      "Harga terlihat kuat, namun posisinya sudah cukup tinggi dibanding area rata-rata dan level penting. Lebih bijak menunggu harga mendingin daripada masuk di area yang rawan profit taking.";
  }

  return {
    label,
    score,
    signals,
    actionBias,
    conclusionTitle,
    conclusionBody,
    rsi,
    macdLine,
    macdSignal,
    macdHist,
    ma5,
    ma20,
    ma50,
    ma200,
    srLevels,
  };
}
