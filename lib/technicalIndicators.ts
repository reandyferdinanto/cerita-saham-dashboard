/**
 * Technical indicators and pattern detection for swing/momentum trading (1-3 day holds).
 * All inputs expect rows ordered NEWEST FIRST (rows[0] = today, rows[1] = yesterday, ...).
 */

export type OHLCVRow = {
  high: number | null | undefined;
  low: number | null | undefined;
  close: number | null | undefined;
  openPrice?: number | null | undefined;
  volume: number | null | undefined;
  previous?: number | null | undefined;
};

const safe = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const isValid = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

// ---------- True Range and ATR ----------
export function trueRange(current: OHLCVRow, prev: OHLCVRow | undefined): number {
  const high = safe(current.high);
  const low = safe(current.low);
  if (!prev) return Math.max(0, high - low);
  const prevClose = safe(prev.close);
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/**
 * ATR(period) on rows ordered NEWEST FIRST. Returns null if not enough data.
 */
export function calculateATR(rows: OHLCVRow[], period = 14): number | null {
  if (rows.length < period + 1) return null;
  // Build true ranges for the most recent `period` bars (using the bar before each as reference).
  const trs: number[] = [];
  for (let i = 0; i < period; i++) {
    const current = rows[i];
    const prev = rows[i + 1];
    trs.push(trueRange(current, prev));
  }
  const sum = trs.reduce((acc, value) => acc + value, 0);
  return sum / period;
}

// ---------- Relative Volume ----------
/**
 * RVOL = today volume / average volume over `period` bars (excluding today).
 */
export function calculateRVOL(rows: OHLCVRow[], period = 20): number | null {
  if (rows.length < period + 1) return null;
  const todayVol = safe(rows[0]?.volume);
  if (todayVol <= 0) return 0;
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += safe(rows[i]?.volume);
  }
  if (sum <= 0) return null;
  const avg = sum / period;
  return todayVol / avg;
}

// ---------- Bollinger Bands and Squeeze ----------
function sma(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = sma(values);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export type BollingerBandResult = {
  middle: number;
  upper: number;
  lower: number;
  width: number;
  widthPercent: number;
};

/**
 * Bollinger Bands at `index` of rows (newest=0). Returns null if not enough data.
 */
export function bollingerBands(
  rows: OHLCVRow[],
  index = 0,
  period = 20,
  stdMultiplier = 2,
): BollingerBandResult | null {
  if (rows.length < index + period) return null;
  const closes: number[] = [];
  for (let i = index; i < index + period; i++) {
    closes.push(safe(rows[i]?.close));
  }
  const middle = sma(closes);
  const sd = stddev(closes);
  const upper = middle + sd * stdMultiplier;
  const lower = middle - sd * stdMultiplier;
  const width = upper - lower;
  const widthPercent = middle > 0 ? (width / middle) * 100 : 0;
  return { middle, upper, lower, width, widthPercent };
}

/**
 * Detect Bollinger Band Squeeze: today's BB width is in the bottom 25% of the last `lookback` days.
 */
export function detectBBSqueeze(
  rows: OHLCVRow[],
  period = 20,
  lookback = 60,
  percentileThreshold = 0.25,
): { isSqueeze: boolean; widthPercent: number | null; thresholdPercent: number | null } {
  if (rows.length < period + lookback) {
    return { isSqueeze: false, widthPercent: null, thresholdPercent: null };
  }
  const todayBB = bollingerBands(rows, 0, period);
  if (!todayBB) return { isSqueeze: false, widthPercent: null, thresholdPercent: null };

  const widths: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const bb = bollingerBands(rows, i, period);
    if (bb) widths.push(bb.widthPercent);
  }
  if (widths.length === 0) return { isSqueeze: false, widthPercent: todayBB.widthPercent, thresholdPercent: null };

  const sorted = [...widths].sort((a, b) => a - b);
  const thresholdIndex = Math.floor(sorted.length * percentileThreshold);
  const threshold = sorted[thresholdIndex] ?? sorted[0];

  return {
    isSqueeze: todayBB.widthPercent <= threshold,
    widthPercent: todayBB.widthPercent,
    thresholdPercent: threshold,
  };
}

// ---------- NR7 (Narrowest Range 7) ----------
export function detectNR7(rows: OHLCVRow[]): boolean {
  if (rows.length < 7) return false;
  const today = rows[0];
  const todayRange = safe(today.high) - safe(today.low);
  if (todayRange <= 0) return false;
  for (let i = 1; i < 7; i++) {
    const range = safe(rows[i]?.high) - safe(rows[i]?.low);
    if (range > 0 && range <= todayRange) return false;
  }
  return true;
}

// ---------- Inside Bar ----------
export function detectInsideBar(rows: OHLCVRow[]): boolean {
  if (rows.length < 2) return false;
  const today = rows[0];
  const yest = rows[1];
  const tHigh = safe(today.high);
  const tLow = safe(today.low);
  const yHigh = safe(yest.high);
  const yLow = safe(yest.low);
  if (tHigh <= 0 || tLow <= 0 || yHigh <= 0 || yLow <= 0) return false;
  return tHigh < yHigh && tLow > yLow;
}

// ---------- Pocket Pivot (O'Neil/Minervini) ----------
/**
 * Today is an up day (close > prev close) AND today's volume is greater than the
 * highest down-day volume in the last `lookback` days.
 */
export function detectPocketPivot(rows: OHLCVRow[], lookback = 10): boolean {
  if (rows.length < lookback + 1) return false;
  const today = rows[0];
  const todayClose = safe(today.close);
  const todayVol = safe(today.volume);
  const prevClose = safe(rows[1]?.close);
  if (todayClose <= prevClose || todayVol <= 0) return false;

  let maxDownVol = 0;
  for (let i = 1; i <= lookback; i++) {
    const r = rows[i];
    if (!r) continue;
    const rClose = safe(r.close);
    const rPrevClose = safe(rows[i + 1]?.close ?? r.previous);
    const isDown = rClose < rPrevClose;
    if (isDown && safe(r.volume) > maxDownVol) {
      maxDownVol = safe(r.volume);
    }
  }
  return todayVol > maxDownVol && maxDownVol > 0;
}

// ---------- 6-month High Break ----------
export function detect6MonthHighBreak(rows: OHLCVRow[], lookback = 126): boolean {
  if (rows.length < 2) return false;
  const todayClose = safe(rows[0].close);
  if (todayClose <= 0) return false;
  let maxClose = 0;
  const span = Math.min(lookback, rows.length - 1);
  for (let i = 1; i <= span; i++) {
    const c = safe(rows[i]?.close);
    if (c > maxClose) maxClose = c;
  }
  return maxClose > 0 && todayClose > maxClose;
}

// ---------- Money Flow Index ----------
export function calculateMFI(rows: OHLCVRow[], period = 14): number | null {
  if (rows.length < period + 1) return null;
  let positiveFlow = 0;
  let negativeFlow = 0;
  for (let i = 0; i < period; i++) {
    const cur = rows[i];
    const prev = rows[i + 1];
    if (!cur || !prev) continue;
    const tpCur = (safe(cur.high) + safe(cur.low) + safe(cur.close)) / 3;
    const tpPrev = (safe(prev.high) + safe(prev.low) + safe(prev.close)) / 3;
    const moneyFlow = tpCur * safe(cur.volume);
    if (tpCur > tpPrev) positiveFlow += moneyFlow;
    else if (tpCur < tpPrev) negativeFlow += moneyFlow;
  }
  if (positiveFlow + negativeFlow === 0) return 50;
  if (negativeFlow === 0) return 100;
  const mfRatio = positiveFlow / negativeFlow;
  return 100 - 100 / (1 + mfRatio);
}

// ---------- MACD ----------
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const next = values[i] * k + prev * (1 - k);
    out.push(next);
    prev = next;
  }
  return out;
}

export type MACDResult = {
  macd: number;
  signal: number;
  histogram: number;
  histogramRising: boolean;
};

/**
 * MACD(12,26,9) on rows ordered newest-first. Internally reverses to oldest-first.
 */
export function calculateMACD(rows: OHLCVRow[]): MACDResult | null {
  if (rows.length < 35) return null;
  const closesOldFirst = rows
    .slice(0, 60)
    .map((r) => safe(r.close))
    .reverse();
  if (closesOldFirst.length < 35) return null;
  const ema12 = ema(closesOldFirst, 12);
  const ema26 = ema(closesOldFirst, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(25); // align after ema26 stable
  if (macdLine.length < 9) return null;
  const signalLine = ema(macdLine, 9);
  const lastIdx = macdLine.length - 1;
  const macd = macdLine[lastIdx];
  const signal = signalLine[lastIdx];
  const histogram = macd - signal;
  const prevHist = lastIdx > 0 ? macdLine[lastIdx - 1] - signalLine[lastIdx - 1] : 0;
  return { macd, signal, histogram, histogramRising: histogram > prevHist };
}

// ---------- Stochastic RSI ----------
export function calculateRSI(rows: OHLCVRow[], period = 14): number | null {
  if (rows.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i++) {
    const cur = safe(rows[i]?.close);
    const prev = safe(rows[i + 1]?.close);
    const diff = cur - prev;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (gains + losses === 0) return 50;
  const rs = gains / Math.max(losses, 1e-9);
  return 100 - 100 / (1 + rs);
}

// ---------- RSI Divergence Detection ----------
export type DivergenceType = "bullish" | "bearish" | "hidden_bullish" | "hidden_bearish" | null;

export type RSIDivergence = {
  detected: boolean;
  type: "bullish" | "bearish";
  strength: number;
  priceLow: number;
  priceHigh: number;
  rsiLow: number;
  rsiHigh: number;
};

export type DivergenceResult = {
  type: DivergenceType;
  strength: number; // 0-100 score
  pricePoints: { index: number; value: number }[];
  rsiPoints: { index: number; value: number }[];
  description: string;
};

/**
 * Detect RSI divergence by comparing price action vs RSI over lookback period.
 * Regular Bullish: Price makes lower low, RSI makes higher low
 * Regular Bearish: Price makes higher high, RSI makes lower high
 * Hidden Bullish: Price makes higher low, RSI makes lower low (continuation)
 * Hidden Bearish: Price makes lower high, RSI makes higher high (continuation)
 */
export function detectRSIDivergence(
  rows: OHLCVRow[],
  lookback = 14,
  minBars = 5
): DivergenceResult | null {
  if (rows.length < lookback + 14) return null;

  // Calculate RSI for each bar
  const rsiValues: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const rsi = calculateRSI(rows.slice(i), 14);
    if (rsi !== null) rsiValues.push(rsi);
    else rsiValues.push(50); // neutral fallback
  }

  if (rsiValues.length < minBars) return null;

  // Find local extremes in price and RSI
  const priceExtremes: { index: number; value: number; type: "high" | "low" }[] = [];
  const rsiExtremes: { index: number; value: number; type: "high" | "low" }[] = [];

  for (let i = 2; i < Math.min(lookback - 2, rsiValues.length - 2); i++) {
    const price = safe(rows[i].close);
    const rsi = rsiValues[i];

    // Check if local high
    if (
      price > safe(rows[i - 1].close) &&
      price > safe(rows[i - 2].close) &&
      price > safe(rows[i + 1].close) &&
      price > safe(rows[i + 2].close)
    ) {
      priceExtremes.push({ index: i, value: price, type: "high" });
    }

    // Check if local low
    if (
      price < safe(rows[i - 1].close) &&
      price < safe(rows[i - 2].close) &&
      price < safe(rows[i + 1].close) &&
      price < safe(rows[i + 2].close)
    ) {
      priceExtremes.push({ index: i, value: price, type: "low" });
    }

    // RSI extremes
    if (rsi > rsiValues[i - 1] && rsi > rsiValues[i - 2] && rsi > rsiValues[i + 1] && rsi > rsiValues[i + 2]) {
      rsiExtremes.push({ index: i, value: rsi, type: "high" });
    }
    if (rsi < rsiValues[i - 1] && rsi < rsiValues[i - 2] && rsi < rsiValues[i + 1] && rsi < rsiValues[i + 2]) {
      rsiExtremes.push({ index: i, value: rsi, type: "low" });
    }
  }

  // Look for divergence patterns
  let bestDivergence: DivergenceResult | null = null;
  let maxStrength = 0;

  // Check for regular bullish divergence (price lower low, RSI higher low)
  const priceLows = priceExtremes.filter((p) => p.type === "low").slice(0, 3);
  const rsiLows = rsiExtremes.filter((r) => r.type === "low").slice(0, 3);

  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const recentPriceLow = priceLows[0];
    const olderPriceLow = priceLows[1];
    const recentRsiLow = rsiLows[0];
    const olderRsiLow = rsiLows[1];

    if (recentPriceLow.value < olderPriceLow.value && recentRsiLow.value > olderRsiLow.value) {
      const priceDiff = Math.abs(recentPriceLow.value - olderPriceLow.value) / olderPriceLow.value;
      const rsiDiff = Math.abs(recentRsiLow.value - olderRsiLow.value);
      const strength = Math.min(100, (priceDiff * 100 + rsiDiff) * 0.8);

      if (strength > maxStrength) {
        maxStrength = strength;
        bestDivergence = {
          type: "bullish",
          strength: Math.round(strength),
          pricePoints: [
            { index: olderPriceLow.index, value: olderPriceLow.value },
            { index: recentPriceLow.index, value: recentPriceLow.value },
          ],
          rsiPoints: [
            { index: olderRsiLow.index, value: olderRsiLow.value },
            { index: recentRsiLow.index, value: recentRsiLow.value },
          ],
          description: "Regular Bullish Divergence: Price lower low, RSI higher low",
        };
      }
    }
  }

  // Check for regular bearish divergence (price higher high, RSI lower high)
  const priceHighs = priceExtremes.filter((p) => p.type === "high").slice(0, 3);
  const rsiHighs = rsiExtremes.filter((r) => r.type === "high").slice(0, 3);

  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const recentPriceHigh = priceHighs[0];
    const olderPriceHigh = priceHighs[1];
    const recentRsiHigh = rsiHighs[0];
    const olderRsiHigh = rsiHighs[1];

    if (recentPriceHigh.value > olderPriceHigh.value && recentRsiHigh.value < olderRsiHigh.value) {
      const priceDiff = Math.abs(recentPriceHigh.value - olderPriceHigh.value) / olderPriceHigh.value;
      const rsiDiff = Math.abs(recentRsiHigh.value - olderRsiHigh.value);
      const strength = Math.min(100, (priceDiff * 100 + rsiDiff) * 0.8);

      if (strength > maxStrength) {
        maxStrength = strength;
        bestDivergence = {
          type: "bearish",
          strength: Math.round(strength),
          pricePoints: [
            { index: olderPriceHigh.index, value: olderPriceHigh.value },
            { index: recentPriceHigh.index, value: recentPriceHigh.value },
          ],
          rsiPoints: [
            { index: olderRsiHigh.index, value: olderRsiHigh.value },
            { index: recentRsiHigh.index, value: recentRsiHigh.value },
          ],
          description: "Regular Bearish Divergence: Price higher high, RSI lower high",
        };
      }
    }
  }

  return bestDivergence;
}

// ---------- MACD Histogram Divergence Detection ----------
export type MACDDivergence = {
  detected: boolean;
  type: "bullish" | "bearish";
  strength: number;
  priceLow: number;
  priceHigh: number;
  macdLow: number;
  macdHigh: number;
};

export type MACDDivergenceResult = {
  type: DivergenceType;
  strength: number;
  pricePoints: { index: number; value: number }[];
  histogramPoints: { index: number; value: number }[];
  description: string;
};

/**
 * Detect MACD histogram divergence similar to RSI divergence
 */
export function detectMACDDivergence(
  rows: OHLCVRow[],
  lookback = 14
): MACDDivergenceResult | null {
  if (rows.length < lookback + 35) return null;

  // Calculate MACD histogram for each bar
  const histogramValues: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const macd = calculateMACD(rows.slice(i));
    if (macd !== null) histogramValues.push(macd.histogram);
    else histogramValues.push(0);
  }

  // Find local extremes
  const priceExtremes: { index: number; value: number; type: "high" | "low" }[] = [];
  const histExtremes: { index: number; value: number; type: "high" | "low" }[] = [];

  for (let i = 2; i < Math.min(lookback - 2, histogramValues.length - 2); i++) {
    const price = safe(rows[i].close);
    const hist = histogramValues[i];

    // Price extremes
    if (
      price > safe(rows[i - 1].close) &&
      price > safe(rows[i - 2].close) &&
      price > safe(rows[i + 1].close) &&
      price > safe(rows[i + 2].close)
    ) {
      priceExtremes.push({ index: i, value: price, type: "high" });
    }
    if (
      price < safe(rows[i - 1].close) &&
      price < safe(rows[i - 2].close) &&
      price < safe(rows[i + 1].close) &&
      price < safe(rows[i + 2].close)
    ) {
      priceExtremes.push({ index: i, value: price, type: "low" });
    }

    // Histogram extremes
    if (hist > histogramValues[i - 1] && hist > histogramValues[i - 2] &&
        hist > histogramValues[i + 1] && hist > histogramValues[i + 2]) {
      histExtremes.push({ index: i, value: hist, type: "high" });
    }
    if (hist < histogramValues[i - 1] && hist < histogramValues[i - 2] &&
        hist < histogramValues[i + 1] && hist < histogramValues[i + 2]) {
      histExtremes.push({ index: i, value: hist, type: "low" });
    }
  }

  let bestDivergence: MACDDivergenceResult | null = null;
  let maxStrength = 0;

  // Bullish divergence: price lower low, histogram higher low
  const priceLows = priceExtremes.filter((p) => p.type === "low").slice(0, 2);
  const histLows = histExtremes.filter((h) => h.type === "low").slice(0, 2);

  if (priceLows.length >= 2 && histLows.length >= 2) {
    const recentPriceLow = priceLows[0];
    const olderPriceLow = priceLows[1];
    const recentHistLow = histLows[0];
    const olderHistLow = histLows[1];

    if (recentPriceLow.value < olderPriceLow.value && recentHistLow.value > olderHistLow.value) {
      const priceDiff = Math.abs(recentPriceLow.value - olderPriceLow.value) / olderPriceLow.value;
      const histDiff = Math.abs(recentHistLow.value - olderHistLow.value);
      const strength = Math.min(100, (priceDiff * 100 + histDiff * 10) * 0.7);

      if (strength > maxStrength) {
        maxStrength = strength;
        bestDivergence = {
          type: "bullish",
          strength: Math.round(strength),
          pricePoints: [
            { index: olderPriceLow.index, value: olderPriceLow.value },
            { index: recentPriceLow.index, value: recentPriceLow.value },
          ],
          histogramPoints: [
            { index: olderHistLow.index, value: olderHistLow.value },
            { index: recentHistLow.index, value: recentHistLow.value },
          ],
          description: "MACD Bullish Divergence: Price lower low, Histogram higher low",
        };
      }
    }
  }

  // Bearish divergence: price higher high, histogram lower high
  const priceHighs = priceExtremes.filter((p) => p.type === "high").slice(0, 2);
  const histHighs = histExtremes.filter((h) => h.type === "high").slice(0, 2);

  if (priceHighs.length >= 2 && histHighs.length >= 2) {
    const recentPriceHigh = priceHighs[0];
    const olderPriceHigh = priceHighs[1];
    const recentHistHigh = histHighs[0];
    const olderHistHigh = histHighs[1];

    if (recentPriceHigh.value > olderPriceHigh.value && recentHistHigh.value < olderHistHigh.value) {
      const priceDiff = Math.abs(recentPriceHigh.value - olderPriceHigh.value) / olderPriceHigh.value;
      const histDiff = Math.abs(recentHistHigh.value - olderHistHigh.value);
      const strength = Math.min(100, (priceDiff * 100 + histDiff * 10) * 0.7);

      if (strength > maxStrength) {
        maxStrength = strength;
        bestDivergence = {
          type: "bearish",
          strength: Math.round(strength),
          pricePoints: [
            { index: olderPriceHigh.index, value: olderPriceHigh.value },
            { index: recentPriceHigh.index, value: recentPriceHigh.value },
          ],
          histogramPoints: [
            { index: olderHistHigh.index, value: olderHistHigh.value },
            { index: recentHistHigh.index, value: recentHistHigh.value },
          ],
          description: "MACD Bearish Divergence: Price higher high, Histogram lower high",
        };
      }
    }
  }

  return bestDivergence;
}

// ---------- Fibonacci Levels ----------
export type FibonacciLevels = {
  swingHigh: number;
  swingLow: number;
  range: number;
  retracements: {
    level: number;
    percentage: string;
    price: number;
    label: string;
  }[];
  extensions: {
    level: number;
    percentage: string;
    price: number;
    label: string;
  }[];
  direction: "uptrend" | "downtrend";
};

/**
 * Calculate Fibonacci retracement and extension levels from swing high/low
 * For uptrend: retracements from high down to low, extensions above high
 * For downtrend: retracements from low up to high, extensions below low
 */
export function calculateFibonacciLevels(
  swingHigh: number,
  swingLow: number,
  currentPrice: number
): FibonacciLevels | null {
  if (!isValid(swingHigh) || !isValid(swingLow) || swingHigh <= swingLow) return null;

  const range = swingHigh - swingLow;
  const direction: "uptrend" | "downtrend" = currentPrice >= (swingHigh + swingLow) / 2 ? "uptrend" : "downtrend";

  // Retracement levels (from high to low in uptrend)
  const retracementLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
  const retracements = retracementLevels.map((level) => ({
    level,
    percentage: `${(level * 100).toFixed(1)}%`,
    price: Math.round(swingHigh - range * level),
    label: level === 0 ? "Swing High" : level === 1 ? "Swing Low" : `${(level * 100).toFixed(1)}% Retracement`,
  }));

  // Extension levels (above high in uptrend)
  const extensionLevels = [1.272, 1.618, 2.618];
  const extensions = extensionLevels.map((level) => ({
    level,
    percentage: `${(level * 100).toFixed(1)}%`,
    price: Math.round(swingHigh + range * (level - 1)),
    label: `${(level * 100).toFixed(1)}% Extension`,
  }));

  return {
    swingHigh,
    swingLow,
    range,
    retracements,
    extensions,
    direction,
  };
}

/**
 * Find optimal Fibonacci levels based on recent price action
 * Uses swing high/low detection with adaptive lookback
 */
export function findOptimalFibonacciLevels(
  rows: OHLCVRow[],
  lookback = 30
): FibonacciLevels | null {
  if (rows.length < lookback) return null;

  const swingHigh = findRecentSwingHigh(rows, lookback);
  const swingLow = findRecentSwingLow(rows, lookback);
  const currentPrice = safe(rows[0]?.close);

  if (!swingHigh || !swingLow || !currentPrice) return null;

  return calculateFibonacciLevels(swingHigh, swingLow, currentPrice);
}

// ---------- Swing High/Low ----------
export function findRecentSwingHigh(rows: OHLCVRow[], lookback = 20): number | null {
  if (rows.length < 2) return null;
  let maxHigh = 0;
  const span = Math.min(lookback, rows.length - 1);
  for (let i = 1; i <= span; i++) {
    const h = safe(rows[i]?.high);
    if (h > maxHigh) maxHigh = h;
  }
  return maxHigh > 0 ? maxHigh : null;
}

export function findRecentSwingLow(rows: OHLCVRow[], lookback = 20): number | null {
  if (rows.length < 2) return null;
  let minLow = Infinity;
  const span = Math.min(lookback, rows.length - 1);
  for (let i = 1; i <= span; i++) {
    const l = safe(rows[i]?.low);
    if (l > 0 && l < minLow) minLow = l;
  }
  return Number.isFinite(minLow) ? minLow : null;
}

// ---------- Trade Plan: Entry, Stop Loss, Take Profit, R/R ----------
export type TradePlan = {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number; // R/R based on TP1
  riskRewardRatio2: number; // R/R based on TP2
  riskPercent: number; // % distance from entry to SL
  reward1Percent: number;
  reward2Percent: number;
  basis: string; // explanation of how TP/SL were derived
};

/**
 * Build an actionable trade plan from current price and ATR, with structure overrides.
 * - Entry = current close (or last price)
 * - SL = max(close - 1.5*ATR, swingLow - small buffer) — pick the tighter sensible stop
 * - TP1 = min(close + 1.5*ATR, recentResistance) — cap at resistance if close
 * - TP2 = close + 2.5*ATR (extended target)
 */
export function buildTradePlan(args: {
  close: number;
  atr: number | null;
  swingLow: number | null;
  swingHigh: number | null;
}): TradePlan | null {
  const { close, atr, swingLow, swingHigh } = args;
  if (!isValid(close)) return null;

  // Use ATR if available, else fall back to 3% of price (approximate volatility)
  const effectiveAtr = atr && atr > 0 ? atr : close * 0.03;

  // SL: 1.5*ATR below entry, or just below swing low (whichever is tighter but not too tight)
  const atrSL = close - 1.5 * effectiveAtr;
  let stopLoss = atrSL;
  if (swingLow != null && swingLow < close) {
    const structureSL = swingLow * 0.997; // 0.3% buffer below swing low
    // Take the tighter (higher) SL between ATR and structure (but keep some room)
    // Prefer structure when reasonable, else ATR
    if (structureSL > atrSL && (close - structureSL) / close >= 0.015) {
      stopLoss = structureSL;
    }
  }
  if (stopLoss >= close) return null;

  // TP1 default: 1.5*ATR above entry
  const atrTP1 = close + 1.5 * effectiveAtr;
  let takeProfit1 = atrTP1;
  // If swing high is above and within reasonable distance, use it as TP1
  if (swingHigh != null && swingHigh > close) {
    const distanceToResistance = (swingHigh - close) / close;
    if (distanceToResistance >= 0.015 && distanceToResistance <= 0.08) {
      takeProfit1 = swingHigh * 0.995; // 0.5% below resistance
    }
  }

  const takeProfit2 = close + 2.5 * effectiveAtr;

  const risk = close - stopLoss;
  const reward1 = takeProfit1 - close;
  const reward2 = takeProfit2 - close;
  if (risk <= 0) return null;

  const basis =
    swingLow != null && stopLoss === swingLow * 0.997
      ? "SL di bawah swing low, TP berbasis ATR/resistance"
      : "SL & TP berbasis ATR";

  return {
    entry: Math.round(close),
    stopLoss: Math.round(stopLoss),
    takeProfit1: Math.round(takeProfit1),
    takeProfit2: Math.round(takeProfit2),
    riskRewardRatio: reward1 / risk,
    riskRewardRatio2: reward2 / risk,
    riskPercent: (risk / close) * 100,
    reward1Percent: (reward1 / close) * 100,
    reward2Percent: (reward2 / close) * 100,
    basis,
  };
}

// ---------- Setup Tags Aggregator ----------
export type SetupTag =
  | "RVOL>2"
  | "Pocket Pivot"
  | "BB Squeeze"
  | "NR7"
  | "Inside Bar"
  | "6M High Break"
  | "MACD Bullish"
  | "MFI Strong"
  | "Close at High";

export type StrategySignal = {
  type: "LONG" | "SHORT" | "NEUTRAL";
  strength: number; // 0-100
  confidence: number; // 0-100
  convergenceFactors: string[];
  entryZone: { min: number; max: number } | null;
  stopLoss: number | null;
  targets: { tp1: number; tp2: number; tp3: number } | null;
  riskReward: number | null;
  timeframe: "scalp" | "swing";
  description: string;
};

export type TechnicalSnapshot = {
  atr14: number | null;
  rvol: number | null;
  mfi14: number | null;
  rsi14: number | null;
  macd: MACDResult | null;
  bbSqueeze: boolean;
  bbWidthPercent: number | null;
  nr7: boolean;
  insideBar: boolean;
  pocketPivot: boolean;
  highBreak6M: boolean;
  swingHigh20: number | null;
  swingLow20: number | null;
  setups: SetupTag[];
  tradePlan: TradePlan | null;
  // Phase 1 additions
  rsiDivergence: DivergenceResult | null;
  macdDivergence: MACDDivergenceResult | null;
  fibonacciLevels: FibonacciLevels | null;
  strategySignal: StrategySignal | null;
};

/**
 * Generate strategy signal based on convergence of multiple indicators
 */
export function generateStrategySignal(args: {
  rsiDivergence: DivergenceResult | null;
  macdDivergence: MACDDivergenceResult | null;
  rsi14: number | null;
  macd: MACDResult | null;
  fibLevels: FibonacciLevels | null;
  currentPrice: number;
  tradePlan: TradePlan | null;
}): StrategySignal | null {
  const { rsiDivergence, macdDivergence, rsi14, macd, fibLevels, currentPrice, tradePlan } = args;

  const convergenceFactors: string[] = [];
  let strength = 0;
  let confidence = 0;
  let signalType: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";

  // Check for bullish convergence
  if (rsiDivergence?.type === "bullish") {
    convergenceFactors.push(`RSI Bullish Divergence (${rsiDivergence.strength}%)`);
    strength += rsiDivergence.strength * 0.4;
    confidence += 25;
  }

  if (macdDivergence?.type === "bullish") {
    convergenceFactors.push(`MACD Bullish Divergence (${macdDivergence.strength}%)`);
    strength += macdDivergence.strength * 0.3;
    confidence += 20;
  }

  if (rsi14 !== null && rsi14 < 40) {
    convergenceFactors.push(`RSI Oversold (${rsi14.toFixed(1)})`);
    strength += 15;
    confidence += 15;
  }

  if (macd && macd.histogram > 0 && macd.histogramRising) {
    convergenceFactors.push("MACD Bullish Crossover");
    strength += 20;
    confidence += 15;
  }

  // Check for bearish convergence
  if (rsiDivergence?.type === "bearish") {
    convergenceFactors.push(`RSI Bearish Divergence (${rsiDivergence.strength}%)`);
    strength += rsiDivergence.strength * 0.4;
    confidence += 25;
    signalType = "SHORT";
  }

  if (macdDivergence?.type === "bearish") {
    convergenceFactors.push(`MACD Bearish Divergence (${macdDivergence.strength}%)`);
    strength += macdDivergence.strength * 0.3;
    confidence += 20;
    signalType = "SHORT";
  }

  if (rsi14 !== null && rsi14 > 70) {
    convergenceFactors.push(`RSI Overbought (${rsi14.toFixed(1)})`);
    strength += 15;
    confidence += 15;
    if (signalType === "NEUTRAL") signalType = "SHORT";
  }

  // Determine signal type based on convergence
  if (convergenceFactors.length >= 2 && signalType === "NEUTRAL") {
    signalType = "LONG";
  }

  if (convergenceFactors.length < 2) {
    return null; // Not enough convergence
  }

  // Build entry zone and targets using Fibonacci levels
  let entryZone: { min: number; max: number } | null = null;
  let targets: { tp1: number; tp2: number; tp3: number } | null = null;
  let stopLoss: number | null = tradePlan?.stopLoss ?? null;

  if (fibLevels && signalType === "LONG") {
    // Entry zone: between 38.2% and 61.8% retracement
    const fib382 = fibLevels.retracements.find((r) => r.level === 0.382);
    const fib618 = fibLevels.retracements.find((r) => r.level === 0.618);
    if (fib382 && fib618) {
      entryZone = { min: fib618.price, max: fib382.price };
    }

    // Targets: Fibonacci extensions
    const ext127 = fibLevels.extensions.find((e) => e.level === 1.272);
    const ext162 = fibLevels.extensions.find((e) => e.level === 1.618);
    const ext262 = fibLevels.extensions.find((e) => e.level === 2.618);
    if (ext127 && ext162 && ext262) {
      targets = { tp1: ext127.price, tp2: ext162.price, tp3: ext262.price };
    }

    // Stop loss: below 78.6% retracement or swing low
    const fib786 = fibLevels.retracements.find((r) => r.level === 0.786);
    if (fib786) {
      stopLoss = Math.min(stopLoss ?? fib786.price, fib786.price);
    }
  }

  const riskReward = targets && stopLoss ? (targets.tp1 - currentPrice) / (currentPrice - stopLoss) : tradePlan?.riskRewardRatio ?? null;

  const timeframe: "scalp" | "swing" = convergenceFactors.length >= 3 ? "swing" : "scalp";

  const description =
    signalType === "LONG"
      ? `Bullish setup with ${convergenceFactors.length} convergence factors. Entry near Fibonacci support.`
      : signalType === "SHORT"
      ? `Bearish setup with ${convergenceFactors.length} convergence factors. Consider short position.`
      : "Neutral - insufficient convergence for clear signal.";

  return {
    type: signalType,
    strength: Math.min(100, Math.round(strength)),
    confidence: Math.min(100, Math.round(confidence)),
    convergenceFactors,
    entryZone,
    stopLoss,
    targets,
    riskReward,
    timeframe,
    description,
  };
}

export function buildTechnicalSnapshot(rows: OHLCVRow[]): TechnicalSnapshot {
  const atr14 = calculateATR(rows, 14);
  const rvol = calculateRVOL(rows, 20);
  const mfi14 = calculateMFI(rows, 14);
  const rsi14 = calculateRSI(rows, 14);
  const macd = calculateMACD(rows);
  const bbSqueezeRes = detectBBSqueeze(rows, 20, 60, 0.25);
  const nr7 = detectNR7(rows);
  const insideBar = detectInsideBar(rows);
  const pocketPivot = detectPocketPivot(rows, 10);
  const highBreak6M = detect6MonthHighBreak(rows, 126);
  const swingHigh20 = findRecentSwingHigh(rows, 20);
  const swingLow20 = findRecentSwingLow(rows, 20);

  // Phase 1 additions
  const rsiDivergence = detectRSIDivergence(rows, 20, 5);
  const macdDivergence = detectMACDDivergence(rows, 20);
  const fibonacciLevels = findOptimalFibonacciLevels(rows, 30);

  const setups: SetupTag[] = [];
  if (rvol != null && rvol >= 2) setups.push("RVOL>2");
  if (pocketPivot) setups.push("Pocket Pivot");
  if (bbSqueezeRes.isSqueeze) setups.push("BB Squeeze");
  if (nr7) setups.push("NR7");
  if (insideBar) setups.push("Inside Bar");
  if (highBreak6M) setups.push("6M High Break");
  if (macd && macd.histogram > 0 && macd.histogramRising) setups.push("MACD Bullish");
  if (mfi14 != null && mfi14 >= 60) setups.push("MFI Strong");

  const today = rows[0];
  const closeAtHigh =
    today && isValid(today.high) && isValid(today.close)
      ? safe(today.high) > 0 && (safe(today.high) - safe(today.close)) / safe(today.high) <= 0.01
      : false;
  if (closeAtHigh) setups.push("Close at High");

  const tradePlan = today && isValid(today.close)
    ? buildTradePlan({
        close: safe(today.close),
        atr: atr14,
        swingLow: swingLow20,
        swingHigh: swingHigh20,
      })
    : null;

  const currentPrice = safe(today?.close);
  const strategySignal = generateStrategySignal({
    rsiDivergence,
    macdDivergence,
    rsi14,
    macd,
    fibLevels: fibonacciLevels,
    currentPrice,
    tradePlan,
  });

  return {
    atr14,
    rvol,
    mfi14,
    rsi14,
    macd,
    bbSqueeze: bbSqueezeRes.isSqueeze,
    bbWidthPercent: bbSqueezeRes.widthPercent,
    nr7,
    insideBar,
    pocketPivot,
    highBreak6M,
    swingHigh20,
    swingLow20,
    setups,
    tradePlan,
    rsiDivergence,
    macdDivergence,
    fibonacciLevels,
    strategySignal,
  };
}
