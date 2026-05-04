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

export type RadarSqueezeState = "high" | "normal" | "low" | null;
export type RadarDivergence = "bullish" | "bearish" | null;

export interface RadarMomentumPoint {
  time: string | number;
  momentum: number | null;
  signal: number | null;
  flux: number | null;
  overFlux: number | null;
  squeeze: RadarSqueezeState;
  divergence: RadarDivergence;
}

export interface RadarMomentumDivergenceLink {
  fromTime: string | number;
  toTime: string | number;
  fromValue: number;
  toValue: number;
  type: Exclude<RadarDivergence, null>;
}

export interface RadarMomentumResult {
  status: "supportive" | "caution" | "neutral";
  bias: "bullish" | "bearish" | "mixed";
  summary: string;
  detail: string;
  momentum: number | null;
  signal: number | null;
  flux: number | null;
  squeeze: RadarSqueezeState;
  divergence: RadarDivergence;
  points: RadarMomentumPoint[];
  divergenceLinks: RadarMomentumDivergenceLink[];
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
  radarMomentum: RadarMomentumResult | null;
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

export function calcMACDSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  if (closes.length < slow) {
    return { 
      macd: new Array(closes.length).fill(null), 
      signal: new Array(closes.length).fill(null), 
      hist: new Array(closes.length).fill(null) 
    };
  }

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  
  // MACD Line = EMA(fast) - EMA(slow)
  const macdLine: (number | null)[] = emaFast.map((v, i) => (
    Number.isNaN(v) || Number.isNaN(emaSlow[i]) ? null : v - emaSlow[i]
  ));

  // Signal Line = EMA(MACD Line, signal)
  // To avoid shift, we extract valid numbers, compute EMA, then place back at correct indices.
  const firstValidIdx = macdLine.findIndex(v => v !== null);
  if (firstValidIdx === -1 || macdLine.length - firstValidIdx < signal) {
    return { 
      macd: macdLine, 
      signal: new Array(closes.length).fill(null), 
      hist: new Array(closes.length).fill(null) 
    };
  }

  const validMacdValues = macdLine.slice(firstValidIdx) as number[];
  const validSignalValues = ema(validMacdValues, signal);

  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = 0; i < validSignalValues.length; i++) {
    const val = validSignalValues[i];
    signalLine[i + firstValidIdx] = Number.isNaN(val) ? null : val;
  }

  const hist = macdLine.map((v, i) => {
    const s = signalLine[i];
    if (v === null || s === null) return null;
    return v - s;
  });

  return { macd: macdLine, signal: signalLine, hist };
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

function rollingExtreme(values: number[], period: number, mode: "high" | "low"): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window = values.slice(i - period + 1, i + 1);
    return mode === "high" ? Math.max(...window) : Math.min(...window);
  });
}

function rollingStdev(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(period - 1, 1);
    return Math.sqrt(variance);
  });
}

function smaNullable(values: (number | null)[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window = values.slice(i - period + 1, i + 1);
    if (window.some((value) => value === null)) return null;
    return (window as number[]).reduce((a, b) => a + b, 0) / period;
  });
}

function rmaNullable(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let prev: number | null = null;
  let seed: number[] = [];

  for (const value of values) {
    if (value === null || !Number.isFinite(value)) {
      result.push(null);
      continue;
    }

    if (prev === null) {
      seed = [...seed, value].slice(-period);
      if (seed.length < period) {
        result.push(null);
        continue;
      }
      prev = seed.reduce((a, b) => a + b, 0) / period;
      result.push(prev);
      continue;
    }

    prev = (prev * (period - 1) + value) / period;
    result.push(prev);
  }

  return result;
}

function atrSeries(bars: OHLCVBar[], period: number): (number | null)[] {
  const trueRanges = bars.map((bar, i) => {
    if (i === 0) return bar.high - bar.low;
    const prevClose = bars[i - 1].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose)
    );
  });

  return rmaNullable(trueRanges, period);
}

function linregNullable(values: (number | null)[], period: number): (number | null)[] {
  const xSum = (period * (period - 1)) / 2;
  const x2Sum = ((period - 1) * period * (2 * period - 1)) / 6;
  const divisor = period * x2Sum - xSum * xSum;

  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window = values.slice(i - period + 1, i + 1);
    if (window.some((value) => value === null)) return null;

    const yValues = window as number[];
    const ySum = yValues.reduce((a, b) => a + b, 0);
    const xySum = yValues.reduce((sum, y, x) => sum + x * y, 0);
    const slope = divisor === 0 ? 0 : (period * xySum - xSum * ySum) / divisor;
    const intercept = (ySum - slope * xSum) / period;
    return intercept + slope * (period - 1);
  });
}

function latestNumber(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) return values[i];
  }
  return null;
}

export function calcRadarMomentum(bars: OHLCVBar[], pointLimit: number | null = 90): RadarMomentumResult | null {
  const len = 20;
  const sig = 3;
  const fluxLen = 30;
  const divergenceThreshold = 25;

  if (bars.length < fluxLen + len) return null;

  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const hl2 = bars.map((bar) => (bar.high + bar.low) / 2);
  const hl2Average = sma(hl2, len);
  const highestHigh = rollingExtreme(highs, len, "high");
  const lowestLow = rollingExtreme(lows, len, "low");
  const atr = atrSeries(bars, len);

  const rawMomentum = bars.map((bar, i) => {
    const rangeMid =
      highestHigh[i] === null || lowestLow[i] === null
        ? null
        : (highestHigh[i] + lowestLow[i]) / 2;
    const averageMid =
      rangeMid === null || hl2Average[i] === null ? null : (rangeMid + hl2Average[i]) / 2;
    const atrValue = atr[i];

    if (averageMid === null || atrValue === null || atrValue === 0) return null;
    return ((bar.close - averageMid) / atrValue) * 100;
  });

  const momentum = linregNullable(rawMomentum, len);
  const signal = smaNullable(momentum, sig);

  const atrFlux = atrSeries(bars, fluxLen);
  const upRaw = bars.map((bar, i) => {
    if (i === 0) return 0;
    return Math.max(bar.high - bars[i - 1].high, 0);
  });
  const downRaw = bars.map((bar, i) => {
    if (i === 0) return 0;
    return Math.max((bar.low - bars[i - 1].low) * -1, 0);
  });
  const upRma = rmaNullable(upRaw, fluxLen);
  const downRma = rmaNullable(downRaw, fluxLen);
  const fluxRaw = bars.map((_, i) => {
    const tr = atrFlux[i];
    const up = upRma[i];
    const down = downRma[i];
    if (tr === null || tr === 0 || up === null || down === null) return null;

    const upRatio = up / tr;
    const downRatio = down / tr;
    const total = upRatio + downRatio;
    if (total === 0) return null;
    return ((upRatio - downRatio) / total) * 100;
  });
  const flux = rmaNullable(fluxRaw, Math.max(1, Math.floor(fluxLen / 2)));
  const overFlux = flux.map((value) => {
    if (value === null) return null;
    if (value > 25) return value - 25;
    if (value < -25) return value + 25;
    return null;
  });

  const stdev = rollingStdev(closes, len);
  const squeeze = bars.map((_, i): RadarSqueezeState => {
    const deviation = stdev[i];
    const atrValue = atr[i];
    if (deviation === null || atrValue === null) return null;
    if (deviation < atrValue * 0.5) return "high";
    if (deviation < atrValue * 0.75) return "normal";
    if (deviation < atrValue) return "low";
    return null;
  });

  const divergence: RadarDivergence[] = new Array(bars.length).fill(null);
  const divergenceLinks: (RadarMomentumDivergenceLink & { fromIndex: number; toIndex: number })[] = [];
  let lastBearishPivot: { index: number; price: number; signal: number } | null = null;
  let lastBullishPivot: { index: number; price: number; signal: number } | null = null;

  for (let i = 1; i < bars.length; i++) {
    const prevMomentum = momentum[i - 1];
    const prevSignal = signal[i - 1];
    const currMomentum = momentum[i];
    const currSignal = signal[i];

    if (
      prevMomentum === null ||
      prevSignal === null ||
      currMomentum === null ||
      currSignal === null
    ) {
      continue;
    }

    const crossedDown = prevMomentum >= prevSignal && currMomentum < currSignal;
    const crossedUp = prevMomentum <= prevSignal && currMomentum > currSignal;

    if (crossedDown && currMomentum > divergenceThreshold) {
      if (lastBearishPivot && bars[i].high > lastBearishPivot.price && currSignal < lastBearishPivot.signal) {
        divergence[i] = "bearish";
        divergenceLinks.push({
          fromIndex: lastBearishPivot.index,
          toIndex: i,
          fromTime: bars[lastBearishPivot.index].time,
          toTime: bars[i].time,
          fromValue: lastBearishPivot.signal,
          toValue: currSignal,
          type: "bearish",
        });
        lastBearishPivot = null;
      } else {
        lastBearishPivot = { index: i, price: bars[i].high, signal: currSignal };
      }
    }

    if (crossedUp && currMomentum < -divergenceThreshold) {
      if (lastBullishPivot && bars[i].low < lastBullishPivot.price && currSignal > lastBullishPivot.signal) {
        divergence[i] = "bullish";
        divergenceLinks.push({
          fromIndex: lastBullishPivot.index,
          toIndex: i,
          fromTime: bars[lastBullishPivot.index].time,
          toTime: bars[i].time,
          fromValue: lastBullishPivot.signal,
          toValue: currSignal,
          type: "bullish",
        });
        lastBullishPivot = null;
      } else {
        lastBullishPivot = { index: i, price: bars[i].low, signal: currSignal };
      }
    }
  }

  const startIndex = pointLimit === null ? 0 : Math.max(0, bars.length - pointLimit);
  const visibleDivergenceLinks = divergenceLinks
    .filter((link) => link.fromIndex >= startIndex && link.toIndex >= startIndex)
    .map((link) => ({
      fromTime: link.fromTime,
      toTime: link.toTime,
      fromValue: link.fromValue,
      toValue: link.toValue,
      type: link.type,
    }));
  const points: RadarMomentumPoint[] = bars.slice(startIndex).map((bar, relativeIndex) => {
    const i = startIndex + relativeIndex;
    return {
      time: bar.time,
      momentum: momentum[i] ?? null,
      signal: signal[i] ?? null,
      flux: flux[i] ?? null,
      overFlux: overFlux[i] ?? null,
      squeeze: squeeze[i],
      divergence: divergence[i],
    };
  }).filter((point) => point.momentum !== null || point.flux !== null || point.squeeze !== null);

  if (points.length < 10) return null;

  const currentMomentum = latestNumber(momentum);
  const currentSignal = latestNumber(signal);
  const currentFlux = latestNumber(flux);
  const currentSqueeze = [...squeeze].reverse().find((value) => value !== null) ?? null;
  const currentDivergence = [...divergence].reverse().find((value) => value !== null) ?? null;
  const bullishStack =
    currentMomentum !== null &&
    currentSignal !== null &&
    currentFlux !== null &&
    currentMomentum > currentSignal &&
    currentMomentum > 0 &&
    currentFlux > 0;
  const bearishStack =
    currentMomentum !== null &&
    currentSignal !== null &&
    currentFlux !== null &&
    currentMomentum < currentSignal &&
    currentMomentum < 0 &&
    currentFlux < 0;
  const status: RadarMomentumResult["status"] =
    currentDivergence === "bullish" || bullishStack
      ? "supportive"
      : currentDivergence === "bearish" || bearishStack
        ? "caution"
        : "neutral";
  const bias: RadarMomentumResult["bias"] =
    currentMomentum !== null && currentFlux !== null && currentMomentum > 0 && currentFlux > 0
      ? "bullish"
      : currentMomentum !== null && currentFlux !== null && currentMomentum < 0 && currentFlux < 0
        ? "bearish"
        : "mixed";

  const summary =
    status === "supportive"
      ? "Momentum tambahan mulai mendukung"
      : status === "caution"
        ? "Momentum tambahan belum rapi"
        : "Momentum tambahan masih netral";
  const detail =
    status === "supportive"
      ? "Tekanan harga dan flux ikut searah, jadi bisa dipakai sebagai konfirmasi ekstra saat area entry juga masuk akal."
      : status === "caution"
        ? "Garis momentum atau flux belum kompak, jadi tunggu struktur harga lebih jelas sebelum menambah keyakinan."
        : "Belum ada dorongan yang cukup jelas dari tekanan harga; tetap prioritaskan MA, RSI, MACD, serta area support-resistance.";

  return {
    status,
    bias,
    summary,
    detail,
    momentum: currentMomentum,
    signal: currentSignal,
    flux: currentFlux,
    squeeze: currentSqueeze,
    divergence: currentDivergence,
    points,
    divergenceLinks: visibleDivergenceLinks,
  };
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
  const radarMomentum = calcRadarMomentum(bars);

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

  if (radarMomentum) {
    if (radarMomentum.status === "supportive") {
      signals.push({
        name: "Radar Momentum",
        value: radarMomentum.summary,
        signal: "buy",
        weight: 6,
      });
    } else if (radarMomentum.status === "caution") {
      signals.push({
        name: "Radar Momentum",
        value: radarMomentum.summary,
        signal: "sell",
        weight: 6,
      });
    } else {
      signals.push({
        name: "Radar Momentum",
        value: radarMomentum.summary,
        signal: "neutral",
        weight: 0,
      });
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
    radarMomentum,
  };
}
