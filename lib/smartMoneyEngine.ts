// Smart Money Behavior Engine — v2
// Focus: detect signals BEFORE the big volume + price spike (leading indicators).
// Key signals: supply exhaustion, OBV-price divergence, volume dry-up on dips,
// range compression, quiet close near high, down-day volume tapering.

import { getHistory, getQuote } from "@/lib/yahooFinance";
import { calcTechnicalSignals, OHLCVBar } from "@/lib/technicalSignals";

export type SmartMoneyPhase =
  | "akumulasi_awal"
  | "akumulasi_aktif"
  | "pre_markup"        // NEW: leading stage, before volume spike
  | "markup_siap"
  | "markup_berlangsung"
  | "distribusi_persiapan"
  | "distribusi_aktif"
  | "markdown"
  | "transisi";

export type EventType =
  | "supply_exhaustion"       // sell-side volume tapering — LEADING
  | "obv_price_divergence"    // OBV rising, price flat — LEADING
  | "dry_dip"                 // price dips on tiny volume — LEADING
  | "range_compression"       // price range narrowing day by day — LEADING
  | "quiet_close_high"        // closes near daily high on low-avg volume — LEADING
  | "down_volume_taper"       // declining sell volume trend — LEADING
  | "stealth_accumulation"    // mod-abv vol, flat price, small body
  | "support_bounce"          // wick demand at support
  | "volume_surge_up"         // already-happened: big vol + up move
  | "markup_trigger"          // already-happened: breakout
  | "distribution_candle"     // already-happened: big vol + down
  | "resistance_rejection";   // already-happened: rejection at top

export type SmartMoneyEvent = {
  date: string;
  type: EventType;
  label: string;
  detail: string;
  price: number;
  volume: number;
  relVolume: number;
  isLeading: boolean; // true = before the surge; false = already happened
};

export type SmartMoneyHabit = {
  pattern: string;
  occurrences: number;
  description: string;
  lastSeen: string;
  implication: string;
};

export type SmartMoneyCycle = {
  startDate: string;
  endDate: string;
  phase: SmartMoneyPhase;
  phaseLabel: string;
  priceStart: number;
  priceEnd: number;
  changePct: number;
  durationDays: number;
  keyEvent: string;
};

export type PreMarkupSignal = {
  name: string;
  active: boolean;
  score: number;   // 0–20 contribution
  detail: string;
};

export type ChartBar = {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  obv: number;
};

export type SmartMoneyResult = {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  currentPhase: SmartMoneyPhase;
  currentPhaseLabel: string;
  currentPhaseSummary: string;
  conviction: number;
  readinessScore: number;
  preMarkupScore: number;
  preMarkupSignals: PreMarkupSignal[];
  chartData: ChartBar[];      // last 120 bars for chart rendering
  events: SmartMoneyEvent[];
  habits: SmartMoneyHabit[];
  cycles: SmartMoneyCycle[];
  metrics: {
    avgAccumulationDays: number | null;
    avgMarkupGainPct: number | null;
    avgCycleLength: number | null;
    typicalMarkupTrigger: string;
    recentVolumeProfile: "accumulation" | "distribution" | "neutral";
    stealthScore: number;
    supplyAbsorptionRate: number | null;
    sellVolumeTrend: "drying" | "stable" | "rising"; // key leading metric
    downDayVolRatio: number | null; // recent down-day vol vs 20d avg
    obvPriceDivergence: boolean;
    rangeCompressionPct: number | null;
  };
  stockSummaryInsight: string | null;
  recommendation: string;
  warnings: string[];
  dataQuality: "good" | "limited" | "insufficient";
};

// ─── Math helpers ─────────────────────────────────────────────────────────

function mean(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function linSlope(arr: number[]) {
  const n = arr.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2, ym = mean(arr);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xm) * (arr[i] - ym); den += (i - xm) ** 2; }
  return den === 0 ? 0 : num / den;
}

function computeObv(bars: OHLCVBar[]) {
  let v = 0;
  return bars.map((b, i) => {
    if (i === 0) return 0;
    if (b.close > bars[i - 1].close) v += b.volume;
    else if (b.close < bars[i - 1].close) v -= b.volume;
    return v;
  });
}

function computeAD(bars: OHLCVBar[]) {
  let v = 0;
  return bars.map((b) => {
    const r = b.high - b.low;
    v += r === 0 ? 0 : ((b.close - b.low) - (b.high - b.close)) / r * b.volume;
    return v;
  });
}

function toDate(bar: OHLCVBar) {
  return typeof bar.time === "string" ? bar.time : new Date(Number(bar.time) * 1000).toISOString().slice(0, 10);
}

// ─── Leading pre-markup signal checkers ──────────────────────────────────

function checkSupplyExhaustion(bars: OHLCVBar[], avgVolSeries: number[]): PreMarkupSignal {
  // Down-day volumes in last 10 days shrinking vs down-day volumes in prior 10 days
  const recent = bars.slice(-10);
  const prior  = bars.slice(-20, -10);
  const dnRecent = recent.filter((b, i) => i > 0 && b.close < recent[i - 1].close).map(b => b.volume);
  const dnPrior  = prior.filter((b, i)  => i > 0 && b.close < prior[i - 1].close).map(b => b.volume);
  const ratio = dnRecent.length > 0 && dnPrior.length > 0
    ? mean(dnRecent) / mean(dnPrior) : 1;
  const active = ratio < 0.65 && dnRecent.length >= 2;
  return {
    name: "Supply Exhaustion",
    active,
    score: active ? 20 : 0,
    detail: active
      ? `Volume hari turun 10 hari terakhir hanya ${(ratio * 100).toFixed(0)}% dari 10 hari sebelumnya. Penjual mulai kehabisan amunisi — klasik tanda sebelum markup.`
      : `Volume hari turun belum menunjukkan pengeringan yang signifikan (rasio ${(ratio * 100).toFixed(0)}%).`,
  };
}

function checkOBVPriceDivergence(bars: OHLCVBar[], obv: number[]): PreMarkupSignal {
  // Last 15 bars: price net change near zero, OBV rising
  const recent = bars.slice(-15);
  const recentObv = obv.slice(-15);
  const priceChange = recent[0].close > 0
    ? ((recent[recent.length - 1].close - recent[0].close) / recent[0].close) * 100 : 0;
  const obvSlope = linSlope(recentObv);
  const active = Math.abs(priceChange) < 4 && obvSlope > 0;
  return {
    name: "OBV-Price Divergence",
    active,
    score: active ? 20 : 0,
    detail: active
      ? `Harga bergerak tipis (${priceChange.toFixed(1)}%) dalam 15 hari terakhir tetapi OBV terus naik. Artinya ada penyerapan supply yang tidak terlihat dari chart harga.`
      : `Tidak ada divergensi yang jelas antara OBV dan harga saat ini.`,
  };
}

function checkDryDips(bars: OHLCVBar[], avgVolSeries: number[]): PreMarkupSignal {
  // Count dip days (close < prev close > 0.5%) with volume < 70% of avg in last 20 days
  const recent = bars.slice(-20);
  let count = 0;
  for (let i = 1; i < recent.length; i++) {
    const change = ((recent[i].close - recent[i - 1].close) / recent[i - 1].close) * 100;
    const avgVol = avgVolSeries[bars.length - 20 + i] || 1;
    const relVol = recent[i].volume / avgVol;
    if (change <= -0.5 && relVol < 0.7) count++;
  }
  const active = count >= 3;
  return {
    name: "Dry-Volume Dip",
    active,
    score: active ? 15 : 0,
    detail: active
      ? `${count} dari 20 hari terakhir: harga turun lebih dari 0.5% dengan volume <70% rata-rata. Saat harga turun tidak ada yang panik jual — ini sinyal supply sudah menipis.`
      : `Baru ${count} hari penurunan bervolume kecil dalam 20 hari terakhir (perlu ≥3).`,
  };
}

function checkRangeCompression(bars: OHLCVBar[]): PreMarkupSignal {
  // Compare range (high-low) of last 5 days vs days 10-20 ago
  const recent5   = bars.slice(-5);
  const prior10   = bars.slice(-15, -5);
  const rangeNow  = mean(recent5.map(b => b.high - b.low));
  const rangePrev = mean(prior10.map(b => b.high - b.low));
  const priceMid  = mean(recent5.map(b => b.close));
  const comprPct  = rangePrev > 0 ? (rangeNow / rangePrev) * 100 : 100;
  const comprRelToPx = priceMid > 0 ? (rangeNow / priceMid) * 100 : 99;
  const active = comprPct < 60 && comprRelToPx < 3;
  return {
    name: "Range Compression",
    active,
    score: active ? 15 : 0,
    detail: active
      ? `Range harian 5 hari terakhir hanya ${comprPct.toFixed(0)}% dari range 10 hari sebelumnya. Harga sedang "dijepit" dalam area sempit — klasik spring sebelum jalan.`
      : `Range belum cukup sempit (${comprPct.toFixed(0)}% dari sebelumnya, perlu <60%).`,
  };
}

function checkQuietCloseNearHigh(bars: OHLCVBar[], avgVolSeries: number[]): PreMarkupSignal {
  // In last 10 days, count bars: close in top 25% of day's range AND volume <= avg
  const recent = bars.slice(-10);
  let count = 0;
  for (let i = 0; i < recent.length; i++) {
    const bar = recent[i];
    const range = bar.high - bar.low;
    if (range === 0) continue;
    const relPos = (bar.close - bar.low) / range; // 0=closed at low, 1=closed at high
    const avgVol = avgVolSeries[bars.length - 10 + i] || 1;
    const relVol = bar.volume / avgVol;
    if (relPos >= 0.75 && relVol <= 1.1) count++;
  }
  const active = count >= 4;
  return {
    name: "Quiet Close Near High",
    active,
    score: active ? 15 : 0,
    detail: active
      ? `${count} dari 10 hari terakhir: harga ditutup dekat high harian (top 25% range) meski volume normal/rendah. Bandar tidak butuh volume besar untuk jaga harga — supply sudah dikuasai.`
      : `Baru ${count} hari memenuhi pola quiet close near high (perlu ≥4 dari 10 hari).`,
  };
}

function checkDownVolumeTaper(bars: OHLCVBar[], avgVolSeries: number[]): PreMarkupSignal {
  // Look at volume of every down-day in last 15 days, check if trending down
  const recent   = bars.slice(-15);
  const dnVolSeq: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].close < recent[i - 1].close) {
      const avg = avgVolSeries[bars.length - 15 + i] || 1;
      dnVolSeq.push(recent[i].volume / avg);
    }
  }
  const sl = dnVolSeq.length >= 3 ? linSlope(dnVolSeq) : 0;
  const active = dnVolSeq.length >= 3 && sl < -0.04;
  return {
    name: "Down-Volume Taper Trend",
    active,
    score: active ? 15 : 0,
    detail: active
      ? `Volume relatif pada hari-hari turun menunjukkan tren menurun (slope ${sl.toFixed(3)}). Setiap koreksi membawa tekanan jual yang semakin lemah — tanda distribusi hampir habis.`
      : dnVolSeq.length < 3
      ? "Tidak cukup hari turun untuk menghitung tren."
      : `Tren volume hari turun belum cukup miring ke bawah (slope ${sl.toFixed(3)}).`,
  };
}

// ─── Event detection (with isLeading flag) ───────────────────────────────

function detectEvents(bars: OHLCVBar[], avgVolSeries: number[]): SmartMoneyEvent[] {
  const events: SmartMoneyEvent[] = [];

  for (let i = 5; i < bars.length; i++) {
    const bar = bars[i];
    const avgVol = avgVolSeries[i] || 1;
    const relVol = bar.volume / avgVol;
    const prev = bars[i - 1];
    const changeDay = prev.close > 0 ? ((bar.close - prev.close) / prev.close) * 100 : 0;
    const range = bar.high - bar.low;
    const body  = Math.abs(bar.close - bar.open);
    const lowerWick = Math.min(bar.close, bar.open) - bar.low;
    const upperWick = bar.high - Math.max(bar.close, bar.open);
    const date = toDate(bar);
    const prevBars = bars.slice(Math.max(0, i - 5), i);

    // --- Leading events ---

    // Supply exhaustion: down day with very low volume
    if (changeDay <= -0.5 && relVol < 0.65) {
      events.push({ date, type: "supply_exhaustion", isLeading: true,
        label: "🔍 Supply Mengering",
        detail: `Harga turun ${Math.abs(changeDay).toFixed(1)}% dengan volume hanya ${(relVol * 100).toFixed(0)}% rata-rata. Penjual tidak ada tenaga.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // Dry dip: price dips but volume tiny
    if (changeDay <= -0.8 && relVol < 0.60) {
      events.push({ date, type: "dry_dip", isLeading: true,
        label: "🔍 Dip Tanpa Penjual",
        detail: `Koreksi ${Math.abs(changeDay).toFixed(1)}% dengan volume ${(relVol * 100).toFixed(0)}% rata-rata. Tidak ada panik — supply sudah habis di bawah.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // Quiet close near daily high (low volume but strong close)
    if (range > 0 && (bar.close - bar.low) / range >= 0.80 && relVol <= 0.90 && changeDay >= 0) {
      events.push({ date, type: "quiet_close_high", isLeading: true,
        label: "🔍 Tutup Kuat, Volume Senyap",
        detail: `Harga ditutup di ${(((bar.close - bar.low) / range) * 100).toFixed(0)}% dari range hari ini dengan volume hanya ${(relVol * 100).toFixed(0)}% rata-rata. Tidak perlu volume besar untuk menahan harga — supply terkontrol.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // Stealth accumulation: mod-above volume, flat, small body
    if (relVol >= 1.2 && relVol < 2.2 && changeDay >= -0.5 && changeDay <= 1.5 && range > 0 && body / range < 0.35) {
      events.push({ date, type: "stealth_accumulation", isLeading: true,
        label: "🔍 Akumulasi Senyap",
        detail: `Volume ${relVol.toFixed(1)}x rata-rata, harga hampir tidak bergerak (${changeDay.toFixed(1)}%). Barang diserap diam-diam.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // OBV divergence window (mark on day that ends a flat-price/rising-OBV run)
    // Handled separately in the signal section; skipped per-bar to avoid noise

    // Support bounce: lower wick > 55%, close > open, vol OK
    if (range > 0 && lowerWick / range >= 0.55 && bar.close > bar.open && relVol >= 0.8) {
      const prevLow = Math.min(...prevBars.map(b => b.low));
      if (bar.low <= prevLow * 1.01) {
        events.push({ date, type: "support_bounce", isLeading: true,
          label: "🔍 Pantulan Support",
          detail: `Ekor bawah ${((lowerWick / range) * 100).toFixed(0)}% dari range. Demand muncul saat harga hampir menyentuh support — belum butuh volume besar.`,
          price: bar.close, volume: bar.volume, relVolume: relVol });
      }
    }

    // --- Already-happened events ---

    // Volume surge up (markup signal — came late)
    if (relVol >= 2.2 && changeDay > 1.5 && bar.close > bar.open) {
      events.push({ date, type: "volume_surge_up", isLeading: false,
        label: "📈 Volume Surge Naik",
        detail: `Volume ${relVol.toFixed(1)}x rata-rata, naik ${changeDay.toFixed(1)}%. Markup sudah mulai — untuk posisi baru pastikan entry tidak terlalu kejar.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // Markup trigger (breakout)
    if (i >= 20) {
      const h20 = Math.max(...bars.slice(i - 20, i).map(b => b.high));
      if (bar.close > h20 && relVol >= 1.5 && changeDay > 2) {
        events.push({ date, type: "markup_trigger", isLeading: false,
          label: "🚀 Pemicu Markup",
          detail: `Breakout di atas high 20 hari (${h20.toFixed(0)}) dengan volume ${relVol.toFixed(1)}x. Entry optimal sudah terlewat — tunggu pullback.`,
          price: bar.close, volume: bar.volume, relVolume: relVol });
      }
    }

    // Distribution candle
    if (relVol >= 2.0 && changeDay < -1.5 && bar.close < bar.open) {
      events.push({ date, type: "distribution_candle", isLeading: false,
        label: "⚠️ Distribusi Volume Besar",
        detail: `Volume ${relVol.toFixed(1)}x, turun ${Math.abs(changeDay).toFixed(1)}%. Supply dilepas agresif.`,
        price: bar.close, volume: bar.volume, relVolume: relVol });
    }

    // Resistance rejection
    if (range > 0 && upperWick / range >= 0.55 && bar.close < bar.open && relVol >= 1.0) {
      const prevHigh = Math.max(...prevBars.map(b => b.high));
      if (bar.high >= prevHigh * 0.995) {
        events.push({ date, type: "resistance_rejection", isLeading: false,
          label: "⚠️ Penolakan Resistance",
          detail: `Ekor atas ${((upperWick / range) * 100).toFixed(0)}% dari range. Supply masih kuat di atas.`,
          price: bar.close, volume: bar.volume, relVolume: relVol });
      }
    }
  }

  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
}

// ─── Phase classification ─────────────────────────────────────────────────

function classifyPhase(args: {
  bars: OHLCVBar[]; obv: number[]; ad: number[];
  technical: ReturnType<typeof calcTechnicalSignals>;
  preMarkupScore: number;
}): { phase: SmartMoneyPhase; label: string; summary: string; readiness: number; conviction: number } {
  const { bars, obv, ad, technical, preMarkupScore } = args;
  const n = bars.length;
  const last = bars[n - 1];
  const obs20 = linSlope(obv.slice(-20));
  const ads20 = linSlope(ad.slice(-20));
  const obs5  = linSlope(obv.slice(-5));
  const ads5  = linSlope(ad.slice(-5));

  const r20   = bars.slice(-20);
  const r5    = bars.slice(-5);
  const avgV5 = mean(r5.map(b => b.volume));
  const avgV20= mean(r20.map(b => b.volume));
  const volR  = avgV20 > 0 ? avgV5 / avgV20 : 1;

  const upV   = r20.filter((b, i) => i > 0 && b.close >= r20[i - 1].close).reduce((s, b) => s + b.volume, 0);
  const dnV   = r20.filter((b, i) => i > 0 && b.close <  r20[i - 1].close).reduce((s, b) => s + b.volume, 0);
  const udR   = dnV > 0 ? upV / dnV : 1;

  const h20 = Math.max(...r20.map(b => b.high));
  const l20 = Math.min(...r20.map(b => b.low));
  const range20pct = h20 > 0 ? ((h20 - l20) / h20) * 100 : null;

  const pvMa20 = technical.ma20 ? ((last.close - technical.ma20) / technical.ma20) * 100 : null;
  const pvMa50 = technical.ma50 ? ((last.close - technical.ma50) / technical.ma50) * 100 : null;
  const breakDist = h20 > 0 ? ((h20 - last.close) / h20) * 100 : null;

  const rsi = technical.rsi;
  const cheap = last.close <= 300;
  const abvMa20 = pvMa20 !== null && pvMa20 > 0;
  const abvMa50 = pvMa50 !== null && pvMa50 > 0;
  const tight = range20pct !== null && range20pct <= 12;
  const nearBk = breakDist !== null && breakDist <= 5;

  // Priority 1: Markup berlangsung
  if (abvMa20 && abvMa50 && obs20 > 0 && ads20 > 0 && pvMa50 !== null && pvMa50 > 8 && (rsi ?? 0) > 55) {
    return { phase: "markup_berlangsung", label: "Markup Berlangsung",
      summary: "Fase markup aktif. Harga sudah melampaui MA20 dan MA50 dengan OBV/AD naik. Entry awal sudah terlewat — tunggu pullback sehat.",
      readiness: 70, conviction: 75 };
  }

  // Priority 2: Siap markup (volume masih normal, tapi semua leading signal menyala)
  if ((abvMa20 || nearBk) && obs20 > 0 && ads20 > 0 && udR >= 1.1 && (rsi ?? 0) >= 45 && (rsi ?? 100) <= 68) {
    return { phase: "markup_siap", label: "Siap Markup",
      summary: "OBV dan A-D naik, rasio volume beli/jual menguat, harga mendekati area kunci. Jendela entry paling menarik — sebelum volume surge besar terjadi.",
      readiness: 90, conviction: 80 };
  }

  // Priority 3: Pre-markup — leading signals kuat tapi harga belum bergerak
  if (preMarkupScore >= 50 && obs20 > 0 && !abvMa50 && (rsi ?? 100) <= 58) {
    return { phase: "pre_markup", label: "Pre-Markup (Senyap)",
      summary: `Mayoritas sinyal leading menyala (skor ${preMarkupScore}/100): supply mengering, OBV naik saat harga flat, dip bervolume kecil. Ini fase yang paling menarik untuk cicil sebelum volume publik masuk.`,
      readiness: 78, conviction: 72 };
  }

  // Priority 4: Akumulasi aktif
  if (obs20 > 0 && ads20 > 0 && tight && udR >= 0.95 && (rsi ?? 100) <= 62) {
    return { phase: "akumulasi_aktif", label: cheap ? "Akumulasi Aktif (Harga Murah)" : "Akumulasi Aktif",
      summary: "OBV dan A-D menanjak dalam range sempit. Supply diserap bertahap. Volume belum meledak — masih di zona akumulasi diam-diam.",
      readiness: cheap ? 65 : 60, conviction: cheap ? 70 : 65 };
  }

  // Priority 5: Akumulasi awal
  if (obs20 > 0 && ads5 > 0 && (rsi ?? 100) <= 55 && !abvMa50) {
    return { phase: "akumulasi_awal", label: "Akumulasi Awal",
      summary: "OBV mulai menanjak meski harga masih di bawah MA50. Fase paling diam — butuh konfirmasi lanjutan sebelum entry agresif.",
      readiness: 45, conviction: 50 };
  }

  // Distribusi
  if (obs20 < 0 && ads20 < 0 && abvMa20 && (rsi ?? 0) > 60) {
    return { phase: "distribusi_persiapan", label: "Persiapan Distribusi",
      summary: "Harga masih atas MA20 tapi OBV dan A-D melemah. Bandar mulai lepas barang meski harga tampak kuat.",
      readiness: 20, conviction: 55 };
  }
  if (obs20 < 0 && ads20 < 0 && !abvMa50) {
    return { phase: "distribusi_aktif", label: "Distribusi Aktif",
      summary: "OBV dan A-D melemah di bawah MA50. Tekanan jual dominan.",
      readiness: 10, conviction: 60 };
  }
  if (obs20 < 0 && ads20 < 0 && !abvMa20 && !abvMa50) {
    return { phase: "markdown", label: "Fase Markdown",
      summary: "Harga di bawah MA20 dan MA50, OBV/AD melemah. Fase markdown aktif — proteksi modal dulu.",
      readiness: 5, conviction: 65 };
  }

  return { phase: "transisi", label: "Transisi / Belum Jelas",
    summary: "Belum ada pola dominan yang teridentifikasi. Observasi berkala sambil tunggu sinyal yang lebih definitif.",
    readiness: 30, conviction: 40 };
}

// ─── Habits ──────────────────────────────────────────────────────────────

function detectHabits(events: SmartMoneyEvent[]): SmartMoneyHabit[] {
  const habits: SmartMoneyHabit[] = [];
  const by = (t: EventType) => events.filter(e => e.type === t);

  const exhaustion = by("supply_exhaustion");
  const dryDips    = by("dry_dip");
  const stealths   = by("stealth_accumulation");
  const bounces    = by("support_bounce");
  const triggers   = by("markup_trigger");
  const surges     = by("volume_surge_up");
  const distrib    = by("distribution_candle");

  if (exhaustion.length + dryDips.length >= 5) {
    habits.push({
      pattern: "Kebiasaan Pengeringan Supply Sebelum Naik",
      occurrences: exhaustion.length + dryDips.length,
      description: `Ditemukan ${exhaustion.length} sesi supply exhaustion dan ${dryDips.length} dip bervolume kecil. Penjual cepat habis di level rendah.`,
      lastSeen: [...exhaustion, ...dryDips].sort((a, b) => b.date.localeCompare(a.date))[0]?.date || "-",
      implication: "Emiten ini sering menunjukkan kehabisan penjual sebelum markup tiba. Pantau terus area support karena itu zona akumulasi utamanya.",
    });
  }

  if (stealths.length >= 4) {
    habits.push({
      pattern: "Akumulasi Senyap Berulang",
      occurrences: stealths.length,
      description: `${stealths.length} sesi volume di atas rata-rata tapi harga hampir tidak bergerak. Barang dikumpulkan diam-diam.`,
      lastSeen: stealths[0].date,
      implication: "Emiten ini sering memiliki fase serap supply yang tidak terlihat dari chart harga biasa. Mode terbaik: pantau OBV, bukan harga.",
    });
  }

  if (bounces.length >= 2) {
    habits.push({
      pattern: "Pertahanan Support Berulang",
      occurrences: bounces.length,
      description: `${bounces.length} kali demand muncul di area support dengan candle pembalikan.`,
      lastSeen: bounces[0].date,
      implication: "Support emiten ini sering dijaga. Saat harga menyentuh support lagi, probabilitas bounce lebih tinggi berdasarkan rekam jejak.",
    });
  }

  if (triggers.length >= 2) {
    habits.push({
      pattern: "Breakout Bervolume Berulang",
      occurrences: triggers.length,
      description: `${triggers.length} breakout bersih dengan konfirmasi volume.`,
      lastSeen: triggers[0].date,
      implication: "Pola breakout emiten ini terbukti bersih. Sinyal berikutnya lebih bisa diandalkan.",
    });
  }

  if (distrib.length >= 3 && surges.length <= 1) {
    habits.push({
      pattern: "Pola Distribusi Dominan",
      occurrences: distrib.length,
      description: `${distrib.length} candle distribusi bervolume besar lebih banyak dari sinyal akumulasi.`,
      lastSeen: distrib[0].date,
      implication: "Hati-hati dengan asumsi akumulasi — emiten ini memiliki riwayat distribusi aktif.",
    });
  }

  return habits;
}

// ─── Cycles ──────────────────────────────────────────────────────────────

function detectCycles(bars: OHLCVBar[], obv: number[]): SmartMoneyCycle[] {
  if (bars.length < 40) return [];
  const closes = bars.map(b => b.close);
  const W = 10;
  const pivots: { i: number; type: "low" | "high" }[] = [];

  for (let i = W; i < bars.length - W; i++) {
    const sl = closes.slice(i - W, i + W + 1);
    if (closes[i] === Math.min(...sl)) pivots.push({ i, type: "low" });
    else if (closes[i] === Math.max(...sl)) pivots.push({ i, type: "high" });
  }
  pivots.sort((a, b) => a.i - b.i);

  const cycles: SmartMoneyCycle[] = [];
  for (let p = 0; p < pivots.length - 1; p++) {
    const s = pivots[p], e = pivots[p + 1];
    if (e.i - s.i < 5) continue;
    const sb = bars[s.i], eb = bars[e.i];
    const chg = sb.close > 0 ? ((eb.close - sb.close) / sb.close) * 100 : 0;
    const sl  = linSlope(obv.slice(s.i, e.i + 1));

    let phase: SmartMoneyPhase = "transisi", phaseLabel = "Transisi", keyEvent = "Tidak ada pola jelas";
    if (s.type === "low" && e.type === "high") {
      if (chg >= 20 && sl > 0)      { phase = "markup_berlangsung"; phaseLabel = "Markup Berlangsung"; keyEvent = `Naik ${chg.toFixed(1)}% + OBV naik`; }
      else if (chg >= 5 && sl > 0)  { phase = "markup_siap";        phaseLabel = "Awal Markup";        keyEvent = `Naik ${chg.toFixed(1)}% + OBV konfirmasi`; }
      else if (sl > 0)               { phase = "akumulasi_aktif";   phaseLabel = "Akumulasi Aktif";   keyEvent = `Harga flat/naik tipis (${chg.toFixed(1)}%) + OBV naik`; }
      else                           { phase = "akumulasi_awal";    phaseLabel = "Akumulasi Awal";    keyEvent = `Naik ${chg.toFixed(1)}% tapi OBV belum konfirmasi`; }
    } else if (s.type === "high" && e.type === "low") {
      if (chg <= -15 && sl < 0)     { phase = "distribusi_aktif";    phaseLabel = "Distribusi Aktif";    keyEvent = `Turun ${Math.abs(chg).toFixed(1)}% + OBV melemah`; }
      else if (sl < 0)               { phase = "distribusi_persiapan"; phaseLabel = "Persiapan Distribusi"; keyEvent = `Koreksi ${Math.abs(chg).toFixed(1)}%`; }
      else                           { phase = "akumulasi_awal";    phaseLabel = "Koreksi Sehat";     keyEvent = `Koreksi ${Math.abs(chg).toFixed(1)}% + OBV masih positif`; }
    }

    cycles.push({
      startDate: toDate(sb), endDate: toDate(eb),
      phase, phaseLabel,
      priceStart: Math.round(sb.close), priceEnd: Math.round(eb.close),
      changePct: Math.round(chg * 10) / 10,
      durationDays: e.i - s.i,
      keyEvent,
    });
  }
  return cycles.slice(-8);
}

// ─── Main export ──────────────────────────────────────────────────────────

export async function analyzeSmartMoney(
  tickerInput: string,
  stockSummaryData?: { date: string; foreignNetBuy: number; localNetBuy: number; value: number }[]
): Promise<SmartMoneyResult> {
  const normalized = tickerInput.trim().toUpperCase();
  const ticker = normalized.endsWith(".JK") ? normalized : `${normalized}.JK`;

  const [quote, hist] = await Promise.all([
    getQuote(ticker),
    getHistory(ticker, new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10), undefined, "1d"),
  ]);

  if (!quote) throw new Error(`Ticker ${ticker} tidak ditemukan`);

  const bars = hist as OHLCVBar[];
  const dataQuality: SmartMoneyResult["dataQuality"] =
    bars.length >= 120 ? "good" : bars.length >= 60 ? "limited" : "insufficient";
  if (bars.length < 40) throw new Error("Data histori tidak cukup (minimal 40 hari)");

  const technical = calcTechnicalSignals(bars);
  const obv = computeObv(bars);
  const ad  = computeAD(bars);
  const volSeries = bars.map(b => b.volume);
  const avgVol20Series = volSeries.map((_, i) =>
    i < 20 ? mean(volSeries.slice(0, i + 1)) : mean(volSeries.slice(i - 19, i + 1))
  );

  // ── Compute pre-markup signals ──
  const pmSignals: PreMarkupSignal[] = [
    checkSupplyExhaustion(bars, avgVol20Series),
    checkOBVPriceDivergence(bars, obv),
    checkDryDips(bars, avgVol20Series),
    checkRangeCompression(bars),
    checkQuietCloseNearHigh(bars, avgVol20Series),
    checkDownVolumeTaper(bars, avgVol20Series),
  ];
  const preMarkupScore = Math.min(pmSignals.reduce((s, p) => s + p.score, 0), 100);

  const events = detectEvents(bars, avgVol20Series);
  const habits = detectHabits(events);
  const cycles = detectCycles(bars, obv);
  const phaseData = classifyPhase({ bars, obv, ad, technical, preMarkupScore });

  // Build chart data — last 120 bars with OBV
  const slicedBars = bars.slice(-120);
  const chartBars = slicedBars.map((b, idx) => {
    const globalIdx = bars.length - slicedBars.length + idx;
    return {
      time: toDate(b),
      open: Math.round(b.open),
      high: Math.round(b.high),
      low: Math.round(b.low),
      close: Math.round(b.close),
      volume: b.volume,
      obv: Math.round(obv[globalIdx] ?? 0),
    };
  });

  // ── Derived metrics ──
  const recent20 = bars.slice(-20);
  const r5 = bars.slice(-5);
  const upV = recent20.filter((b, i) => i > 0 && b.close >= recent20[i - 1].close).reduce((s, b) => s + b.volume, 0);
  const dnV = recent20.filter((b, i) => i > 0 && b.close <  recent20[i - 1].close).reduce((s, b) => s + b.volume, 0);
  const tot = upV + dnV;
  const recentVolumeProfile: "accumulation" | "distribution" | "neutral" =
    tot === 0 ? "neutral" : upV / tot >= 0.57 ? "accumulation" : dnV / tot >= 0.57 ? "distribution" : "neutral";

  // Sell volume trend over 15 days
  const dnVolSeq: number[] = [];
  for (let i = bars.length - 14; i < bars.length; i++) {
    if (bars[i].close < bars[i - 1].close) dnVolSeq.push(bars[i].volume / (avgVol20Series[i] || 1));
  }
  const sellSlope = dnVolSeq.length >= 3 ? linSlope(dnVolSeq) : 0;
  const sellVolumeTrend: "drying" | "stable" | "rising" =
    sellSlope < -0.035 ? "drying" : sellSlope > 0.035 ? "rising" : "stable";
  const downDayVolRatio = dnV > 0 && tot > 0 ? dnV / tot : null;

  // OBV-price divergence
  const priceCh15 = bars.length >= 16
    ? ((bars[bars.length - 1].close - bars[bars.length - 16].close) / bars[bars.length - 16].close) * 100 : 0;
  const obvSlope15 = linSlope(obv.slice(-15));
  const obvPriceDivergence = Math.abs(priceCh15) < 4 && obvSlope15 > 0;

  // Range compression
  const rangeNow  = mean(r5.map(b => b.high - b.low));
  const rangePrev = mean(bars.slice(-15, -5).map(b => b.high - b.low));
  const rangeCompressionPct = rangePrev > 0 ? (rangeNow / rangePrev) * 100 : null;

  // OBV/AD days up
  const obv20 = obv.slice(-20), ad20 = ad.slice(-20);
  const obvUp = obv20.filter((_, i) => i > 0 && obv20[i] > obv20[i - 1]).length;
  const adUp  = ad20.filter((_, i) => i > 0 && ad20[i] > ad20[i - 1]).length;
  const supplyAbsorptionRate = Math.round(((obvUp + adUp) / 40) * 100);

  const stealthEvts = events.filter(e => e.type === "stealth_accumulation");
  const stealthScore = Math.min(Math.round((stealthEvts.length / Math.max(events.length, 1)) * 100 + (stealthEvts.length >= 3 ? 20 : 0)), 100);

  const markupCycles = cycles.filter(c => c.phase === "markup_berlangsung" || c.phase === "markup_siap");
  const accumCycles  = cycles.filter(c => c.phase === "akumulasi_aktif"    || c.phase === "akumulasi_awal");
  const avgAccumulationDays = accumCycles.length > 0  ? Math.round(mean(accumCycles.map(c => c.durationDays)))  : null;
  const avgMarkupGainPct    = markupCycles.length > 0 ? Math.round(mean(markupCycles.map(c => c.changePct)) * 10) / 10 : null;
  const avgCycleLength      = cycles.length > 0       ? Math.round(mean(cycles.map(c => c.durationDays)))          : null;

  const mEvts = events.filter(e => e.type === "markup_trigger");
  const typicalMarkupTrigger = mEvts.length >= 2
    ? `Breakout bervolume >1.5x (${mEvts.length}x tercatat)`
    : mEvts.length === 1 ? "1 breakout bervolume tercatat" : "Belum cukup data";

  // Stock summary insight
  let stockSummaryInsight: string | null = null;
  if (stockSummaryData && stockSummaryData.length >= 3) {
    const ss = stockSummaryData.slice(-10);
    const fNet = ss.reduce((s, d) => s + d.foreignNetBuy, 0);
    const lNet = ss.reduce((s, d) => s + d.localNetBuy, 0);
    const fDays = ss.filter(d => d.foreignNetBuy > 0).length;
    if (fNet > 0 && fDays >= 3)
      stockSummaryInsight = `Foreign net buy total ${(fNet / 1e9).toFixed(2)}B dalam ${ss.length} hari (${fDays} hari positif). Memperkuat sinyal akumulasi.`;
    else if (fNet < 0 && lNet > 0)
      stockSummaryInsight = `Foreign net sell tapi lokal net beli — sinyal campuran, perhatikan siapa yang keluar.`;
    else if (fNet < 0 && lNet <= 0)
      stockSummaryInsight = `Baik foreign maupun lokal cenderung net jual. Kurang mendukung asumsi akumulasi.`;
    else
      stockSummaryInsight = `Stock Summary sinyal mixed: foreign ${fNet >= 0 ? "net buy" : "net sell"}, lokal ${lNet >= 0 ? "net buy" : "net sell"}.`;
  }

  // Recommendation
  const warnings: string[] = [];
  let recommendation = "";
  const t = ticker.replace(".JK", "");

  if (phaseData.phase === "pre_markup") {
    recommendation = `${t} menunjukkan sinyal leading pre-markup paling kuat saat ini: supply mengering, OBV diverge, dip tanpa penjual. Volume besar belum datang — ini jendela terbaik untuk cicil posisi sebelum publik sadar.`;
  } else if (phaseData.phase === "markup_siap") {
    recommendation = `${t} siap markup. Leading signal kuat dan harga mendekati area breakout. Volume besar kemungkinan segera datang — pertimbangkan posisi dengan tight risk management.`;
  } else if (phaseData.phase === "akumulasi_aktif") {
    recommendation = `${t} dalam akumulasi aktif. Supply diserap diam-diam. Pantau terus leading signal; ketika supply exhaustion + dry dip makin sering, itu pertanda pre-markup sudah dekat.`;
  } else if (phaseData.phase === "akumulasi_awal") {
    recommendation = `${t} baru masuk tanda-tanda akumulasi. Masih terlalu dini untuk agresif, tetapi layak diobservasi aktif.`;
    warnings.push("Konfirmasi lanjutan (OBV naik stabil, dry dip berulang) diperlukan sebelum entry.");
  } else if (phaseData.phase === "markup_berlangsung") {
    recommendation = `${t} sudah markup aktif. Untuk posisi baru tunggu pullback ke support — jangan kejar harga.`;
    warnings.push("Entry optimal sudah berlalu. Hindari FOMO di area yang jauh dari support.");
  } else if (phaseData.phase === "distribusi_aktif" || phaseData.phase === "markdown") {
    recommendation = `${t} dalam distribusi/markdown. Hindari asumsi bottom tanpa konfirmasi demand yang solid.`;
    warnings.push("OBV/AD masih melemah. Supply belum habis.");
    warnings.push("Jangan averaging down tanpa bukti reversal volume.");
  } else {
    recommendation = `${t} belum menunjukkan pola yang jelas. Lakukan observasi berkala.`;
  }

  if (dataQuality === "limited")      warnings.push("Data histori terbatas (<120 hari). Pola historis mungkin kurang lengkap.");
  if (dataQuality === "insufficient") warnings.push("Data sangat terbatas. Hasil hanya estimasi awal.");

  return {
    ticker, name: quote.name || t,
    price: quote.price, changePercent: quote.changePercent,
    currentPhase: phaseData.phase,
    currentPhaseLabel: phaseData.label,
    currentPhaseSummary: phaseData.summary,
    conviction: phaseData.conviction,
    readinessScore: phaseData.readiness,
    preMarkupScore,
    preMarkupSignals: pmSignals,
    chartData: chartBars,
    events, habits, cycles,
    metrics: {
      avgAccumulationDays, avgMarkupGainPct, avgCycleLength,
      typicalMarkupTrigger, recentVolumeProfile, stealthScore,
      supplyAbsorptionRate, sellVolumeTrend, downDayVolRatio,
      obvPriceDivergence, rangeCompressionPct,
    },
    stockSummaryInsight, recommendation, warnings, dataQuality,
  };
}
