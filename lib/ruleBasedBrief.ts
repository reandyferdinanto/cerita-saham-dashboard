// Rule-based stock brief generator for Telegram member bot.
// Produces a deterministic analysis combining technical, fundamental, accumulation, and news data.
// No AI dependency — pure rule-based logic.

import type { TechnicalResult } from "@/lib/technicalSignals";
import type { FundamentalSnapshot } from "@/lib/data/fundamentalSnapshot";
import type { AccumulationSnapshot } from "@/lib/data/accumulationSnapshot";
import type { CachedNewsItem } from "@/lib/data/newsCache";

type QuoteData = { price: number; changePercent: number };

type Verdict = "AMAN ENTRY" | "TUNGGU PULLBACK" | "BERBAHAYA" | "NETRAL";

type BriefResult = {
  verdict: Verdict;
  text: string;
};

// ── Scoring engine ──────────────────────────────────────────────────────────────

function scoreTechnical(tech: TechnicalResult): { score: number; notes: string[] } {
  let score = 0;
  const notes: string[] = [];
  const rsi = tech.rsi ?? 50;

  // RSI zones
  if (rsi > 80) { score -= 3; notes.push(`RSI ${rsi.toFixed(0)} (overbought tinggi)`); }
  else if (rsi > 70) { score -= 1; notes.push(`RSI ${rsi.toFixed(0)} (overbought)`); }
  else if (rsi >= 40 && rsi <= 60) { score += 1; notes.push(`RSI ${rsi.toFixed(0)} (netral)`); }
  else if (rsi < 30) { score += 2; notes.push(`RSI ${rsi.toFixed(0)} (oversold, potensi rebound)`); }

  // MACD
  if (tech.macdHist != null) {
    if (tech.macdHist > 0 && tech.macdLine != null && tech.macdSignal != null && tech.macdLine > tech.macdSignal) {
      score += 1; notes.push("MACD bullish crossover");
    } else if (tech.macdHist < 0) {
      score -= 1; notes.push("MACD bearish");
    }
  }

  // Technical score from the engine
  if (tech.score >= 70) { score += 2; notes.push(`Skor teknikal ${tech.score}/100 (kuat)`); }
  else if (tech.score >= 50) { score += 1; }
  else if (tech.score < 30) { score -= 2; notes.push(`Skor teknikal ${tech.score}/100 (lemah)`); }

  // Action bias
  if (tech.actionBias === "entry") score += 1;
  else if (tech.actionBias === "avoid") score -= 2;
  else if (tech.actionBias === "wait-pullback") score -= 1;

  return { score, notes };
}

function scoreAccumulation(acc: AccumulationSnapshot | null): { score: number; notes: string[] } {
  if (!acc || !acc.available) return { score: 0, notes: ["Data akumulasi belum tersedia"] };
  let score = 0;
  const notes: string[] = [];

  // Foreign flow
  if (acc.foreignAccumulationLabel === "Akumulasi Kuat") { score += 3; notes.push("Foreign akumulasi kuat"); }
  else if (acc.foreignAccumulationLabel === "Akumulasi Moderat") { score += 1; notes.push("Foreign akumulasi moderat"); }
  else if (acc.foreignAccumulationLabel === "Distribusi Kuat") { score -= 3; notes.push("⚠️ Foreign distribusi kuat (seller dominan)"); }
  else if (acc.foreignAccumulationLabel === "Distribusi Moderat") { score -= 1; notes.push("Foreign distribusi moderat"); }

  // Domestic pressure
  if (acc.domesticPressureLabel === "Tekanan Beli Kuat") { score += 2; notes.push("Domestic buyer dominan"); }
  else if (acc.domesticPressureLabel === "Tekanan Beli Moderat") { score += 1; }
  else if (acc.domesticPressureLabel === "Tekanan Jual Kuat") { score -= 2; notes.push("⚠️ Domestic seller dominan"); }
  else if (acc.domesticPressureLabel === "Tekanan Jual Moderat") { score -= 1; notes.push("Domestic seller moderat"); }

  // Bid/offer ratio
  if (acc.averageBidOfferRatio != null) {
    if (acc.averageBidOfferRatio < 0.7) { score -= 1; notes.push(`Bid/Offer ${acc.averageBidOfferRatio.toFixed(2)}x (seller > buyer)`); }
    else if (acc.averageBidOfferRatio > 1.3) { score += 1; }
  }

  return { score, notes };
}

function scoreFundamental(fund: FundamentalSnapshot | null): { score: number; notes: string[] } {
  if (!fund) return { score: 0, notes: [] };
  let score = 0;
  const notes: string[] = [];

  if (fund.roe != null) {
    if (fund.roe > 0.15) { score += 1; notes.push(`ROE ${(fund.roe * 100).toFixed(1)}% (baik)`); }
    else if (fund.roe < 0) { score -= 1; notes.push(`ROE ${(fund.roe * 100).toFixed(1)}% (negatif)`); }
  }

  if (fund.revenueGrowth != null) {
    if (fund.revenueGrowth > 0.1) { score += 1; notes.push(`Revenue growth +${(fund.revenueGrowth * 100).toFixed(1)}%`); }
    else if (fund.revenueGrowth < -0.05) { score -= 1; notes.push(`Revenue growth ${(fund.revenueGrowth * 100).toFixed(1)}%`); }
  }

  if (fund.debtToEquity != null && fund.debtToEquity > 200) {
    score -= 1; notes.push(`D/E ${fund.debtToEquity.toFixed(0)}% (hutang tinggi)`);
  }

  return { score, notes };
}

function determineVerdict(totalScore: number, tech: TechnicalResult, acc: AccumulationSnapshot | null): Verdict {
  const rsi = tech.rsi ?? 50;
  const isDistributing = acc?.foreignAccumulationLabel?.includes("Distribusi") && acc?.domesticPressureLabel?.includes("Jual");

  if (isDistributing && rsi > 70) return "BERBAHAYA";
  if (totalScore >= 5) return "AMAN ENTRY";
  if (totalScore >= 2) return "TUNGGU PULLBACK";
  if (totalScore <= -3 || isDistributing) return "BERBAHAYA";
  return "NETRAL";
}

function verdictDescription(v: Verdict): string {
  switch (v) {
    case "AMAN ENTRY": return "Kondisi mendukung entry. Buyer dominan, teknikal positif.";
    case "TUNGGU PULLBACK": return "Ada potensi, tapi tunggu pullback ke support atau konfirmasi breakout.";
    case "BERBAHAYA": return "Seller masih dominan atau overbought. Hindari entry dulu.";
    default: return "Belum ada sinyal kuat. Pantau perkembangan.";
  }
}

function assessFundamentalQuality(fund: FundamentalSnapshot | null): { label: string; detail: string } {
  if (!fund) return { label: "N/A", detail: "Data fundamental belum tersedia." };
  const issues: string[] = [];
  const positives: string[] = [];

  if (fund.roe != null) {
    if (fund.roe > 0.15) positives.push(`ROE ${(fund.roe * 100).toFixed(1)}% (sehat)`);
    else if (fund.roe > 0) positives.push(`ROE ${(fund.roe * 100).toFixed(1)}% (moderat)`);
    else issues.push(`ROE negatif ${(fund.roe * 100).toFixed(1)}% — perusahaan merugi`);
  }
  if (fund.revenueGrowth != null) {
    if (fund.revenueGrowth > 0.1) positives.push(`Revenue growth +${(fund.revenueGrowth * 100).toFixed(1)}%`);
    else if (fund.revenueGrowth < -0.05) issues.push(`Revenue turun ${(fund.revenueGrowth * 100).toFixed(1)}%`);
  }
  if (fund.debtToEquity != null && fund.debtToEquity > 150) {
    issues.push(`D/E ${fund.debtToEquity.toFixed(0)}% (hutang tinggi)`);
  }
  if (fund.trailingPE != null) {
    if (fund.trailingPE < 0) issues.push("PE negatif (rugi)");
    else if (fund.trailingPE > 40) issues.push(`PE ${fund.trailingPE.toFixed(1)}x (mahal)`);
    else if (fund.trailingPE < 15) positives.push(`PE ${fund.trailingPE.toFixed(1)}x (murah)`);
  }

  if (issues.length === 0 && positives.length > 0) return { label: "BAGUS", detail: positives.join(". ") + "." };
  if (issues.length > positives.length) return { label: "KURANG BAIK", detail: issues.join(". ") + "." };
  return { label: "CUKUP", detail: [...positives, ...issues].join(". ") + "." };
}

function findNearestEmaSupport(price: number, tech: TechnicalResult): { ema: string; value: number; distance: number } | null {
  const emas: { label: string; value: number | null }[] = [
    { label: "EMA9", value: tech.ema9 },
    { label: "EMA20", value: tech.ema20 },
    { label: "EMA50", value: tech.ema50 },
  ];
  // Find nearest EMA below current price as support
  let nearest: { ema: string; value: number; distance: number } | null = null;
  for (const e of emas) {
    if (e.value == null || e.value >= price) continue;
    const dist = ((price - e.value) / price) * 100;
    if (!nearest || dist < nearest.distance) {
      nearest = { ema: e.label, value: e.value, distance: dist };
    }
  }
  return nearest;
}

function assessMomentumHealth(tech: TechnicalResult): { weakening: boolean; note: string } {
  // MACD histogram shrinking = momentum weakening
  if (tech.macdHist != null && tech.macdHist > 0 && tech.macdLine != null && tech.macdSignal != null) {
    // Histogram positive but line approaching signal = momentum fading
    const gap = tech.macdLine - tech.macdSignal;
    if (gap < tech.macdHist * 0.5 && gap > 0) {
      return { weakening: true, note: "MACD histogram mengecil — momentum mulai melemah. Waspada reversal." };
    }
  }
  if (tech.macdHist != null && tech.macdHist < 0) {
    return { weakening: true, note: "MACD bearish — momentum negatif." };
  }
  if (tech.macdHist != null && tech.macdHist > 0) {
    return { weakening: false, note: "MACD bullish — momentum masih sehat." };
  }
  return { weakening: false, note: "" };
}

// ── Main generator ──────────────────────────────────────────────────────────────

export function generateRuleBasedBrief(
  ticker: string,
  name: string,
  quote: QuoteData,
  technical: TechnicalResult,
  fundamental: FundamentalSnapshot | null,
  accumulation: AccumulationSnapshot | null,
  news: CachedNewsItem[],
  sectorNews: CachedNewsItem[]
): BriefResult {
  const techResult = scoreTechnical(technical);
  const accResult = scoreAccumulation(accumulation);
  const fundResult = scoreFundamental(fundamental);
  const totalScore = techResult.score + accResult.score + fundResult.score;

  const verdict = determineVerdict(totalScore, technical, accumulation);
  const fundAssess = assessFundamentalQuality(fundamental);
  const emaSupport = findNearestEmaSupport(quote.price, technical);
  const momentum = assessMomentumHealth(technical);

  // Support/Resistance
  const supports = technical.srLevels.filter((l) => l.type === "S").map((l) => l.price).sort((a, b) => b - a).slice(0, 2);
  const resistances = technical.srLevels.filter((l) => l.type === "R").map((l) => l.price).sort((a, b) => a - b);

  // Trade plan — IDX is long-only, TP must always be above current price
  const resistAbove = resistances.filter((r) => r > quote.price);
  const entry = resistAbove[0] || Math.round(quote.price * 1.01);
  const sl = emaSupport ? Math.round(emaSupport.value * 0.99) : (supports[0] ? supports[0] - Math.round(supports[0] * 0.01) : Math.round(quote.price * 0.95));
  const tp = resistAbove[0] ? Math.round(resistAbove[0] * 1.02) : Math.round(quote.price * 1.1);

  const fmtPrice = (v: number) => v.toLocaleString("id-ID");
  const rsi = technical.rsi ?? 50;
  const isHighPrice = rsi > 65 || (technical.ema20 != null && quote.price > technical.ema20 * 1.08);

  // Build output with Markdown bold (no emojis)
  const lines: string[] = [];

  lines.push(`*${ticker} Brief*`);
  lines.push(`══════════════════════════`);
  lines.push(`*Verdict: ${verdict}*`);
  lines.push(verdictDescription(verdict));
  lines.push(``);
  lines.push(`*Harga:* Rp ${fmtPrice(quote.price)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`);
  lines.push(``);

  // Teknikal
  lines.push(`*Teknikal:* ${technical.conclusionTitle}`);
  for (const note of techResult.notes.slice(0, 3)) {
    lines.push(`  • ${note}`);
  }
  if (momentum.note) {
    lines.push(`  • ${momentum.note}`);
  }
  lines.push(``);

  // EMA Support (especially when price is high)
  if (emaSupport) {
    lines.push(`*Support EMA Terdekat:* ${emaSupport.ema} di ${fmtPrice(Math.round(emaSupport.value))} (${emaSupport.distance.toFixed(1)}% di bawah harga)`);
    if (isHighPrice) {
      lines.push(`  • Harga sudah tinggi dari MA. Jika ${emaSupport.ema} jebol → wajib cut loss.`);
      if (momentum.weakening) {
        lines.push(`  • Momentum melemah + harga jauh dari MA = risiko koreksi tinggi.`);
      }
    }
    lines.push(``);
  }

  // Akumulasi
  lines.push(`*Akumulasi/Distribusi:*`);
  if (accumulation?.available) {
    lines.push(`  • Foreign: ${accumulation.foreignAccumulationLabel}`);
    lines.push(`  • Domestic: ${accumulation.domesticPressureLabel}`);
    if (accumulation.averageBidOfferRatio != null) {
      lines.push(`  • Bid/Offer: ${accumulation.averageBidOfferRatio.toFixed(2)}x`);
    }
  } else {
    lines.push(`  • Data belum tersedia`);
  }
  lines.push(``);

  // Fundamental assessment
  if (fundamental) {
    lines.push(`*Fundamental:* ${fundAssess.label}`);
    const fundMeta: string[] = [];
    if (fundamental.sector) fundMeta.push(fundamental.sector);
    if (fundamental.trailingPE != null) fundMeta.push(`PE ${fundamental.trailingPE.toFixed(1)}x`);
    if (fundamental.roe != null) fundMeta.push(`ROE ${(fundamental.roe * 100).toFixed(1)}%`);
    if (fundamental.revenueGrowth != null) fundMeta.push(`Rev ${(fundamental.revenueGrowth * 100).toFixed(1)}%`);
    if (fundMeta.length > 0) lines.push(`  ${fundMeta.join(" | ")}`);
    lines.push(`  • ${fundAssess.detail}`);
    lines.push(``);
  }

  // News
  const allNews = news.length > 0 ? news : sectorNews;
  if (allNews.length > 0) {
    lines.push(`*Berita:*`);
    for (const n of allNews.slice(0, 2)) {
      const sentLabel = n.sentiment === "positive" ? "[+]" : n.sentiment === "negative" ? "[-]" : "[~]";
      lines.push(`  ${sentLabel} ${n.title}`);
    }
    lines.push(``);
  }

  // Plan
  lines.push(`*Plan:*`);
  if (verdict === "BERBAHAYA") {
    lines.push(`  • Hindari entry. Tunggu seller mereda.`);
    // Only mention support if it's below current price
    const validSupport = supports.find((s) => s < quote.price);
    if (emaSupport) {
      lines.push(`  • Support terdekat: ${emaSupport.ema} di ${fmtPrice(Math.round(emaSupport.value))}`);
      lines.push(`  • Tunggu harga stabil di atas ${emaSupport.ema} sebelum entry.`);
    } else if (validSupport) {
      lines.push(`  • Pantau support di ${fmtPrice(validSupport)}`);
    }
  } else if (isHighPrice && emaSupport) {
    lines.push(`  • Harga sudah tinggi. ${momentum.weakening ? "Momentum melemah — WASPADA." : "Momentum masih oke — hold selama di atas " + emaSupport.ema + "."}`);
    lines.push(`  • Cut Loss: jika close di bawah ${emaSupport.ema} (${fmtPrice(Math.round(emaSupport.value))})`);
    lines.push(`  • Take-Profit: ${fmtPrice(tp)}`);
    if (!momentum.weakening) {
      lines.push(`  • Selama MACD histogram membesar & hijau tua → trend masih valid.`);
    } else {
      lines.push(`  • MACD histogram mengecil/memudar → bersiap exit.`);
    }
  } else {
    lines.push(`  • Entry: ${fmtPrice(entry)} (${verdict === "AMAN ENTRY" ? "bisa langsung" : "setelah konfirmasi breakout"})`);
    lines.push(`  • Stop-Loss: ${fmtPrice(sl)}`);
    lines.push(`  • Take-Profit: ${fmtPrice(tp)}`);
  }

  const text = lines.join("\n");
  return { verdict, text };
}
