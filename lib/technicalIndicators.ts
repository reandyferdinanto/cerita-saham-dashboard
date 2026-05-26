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
};

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
  };
}
