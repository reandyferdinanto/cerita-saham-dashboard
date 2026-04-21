"use client";

import { useState } from "react";
import type { SmartMoneyResult, SmartMoneyPhase } from "@/lib/smartMoneyEngine";
import dynamic from "next/dynamic";

const SmartMoneyChart = dynamic(() => import("@/app/admin/SmartMoneyChart"), { ssr: false, loading: () => <div className="h-60 w-full rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} /> });

function pct(val: number | null, digits = 1) {
  if (val === null) return "–";
  return `${val >= 0 ? "+" : ""}${val.toFixed(digits)}%`;
}
function num(val: number | null) {
  if (val === null) return "–";
  return val.toLocaleString("id-ID");
}

const PHASE_META: Record<SmartMoneyPhase, { color: string; bg: string; border: string; emoji: string }> = {
  akumulasi_awal:       { color: "#93c5fd", bg: "rgba(59,130,246,0.10)",   border: "rgba(59,130,246,0.25)",  emoji: "🔍" },
  akumulasi_aktif:      { color: "#6ee7b7", bg: "rgba(16,185,129,0.10)",   border: "rgba(16,185,129,0.25)",  emoji: "📦" },
  pre_markup:           { color: "#e879f9", bg: "rgba(168,85,247,0.12)",   border: "rgba(168,85,247,0.30)",  emoji: "🎯" },
  markup_siap:          { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   border: "rgba(251,191,36,0.30)",  emoji: "⚡" },
  markup_berlangsung:   { color: "#fb923c", bg: "rgba(249,115,22,0.12)",   border: "rgba(249,115,22,0.28)",  emoji: "🚀" },
  distribusi_persiapan: { color: "#f87171", bg: "rgba(239,68,68,0.09)",    border: "rgba(239,68,68,0.22)",   emoji: "⚠️" },
  distribusi_aktif:     { color: "#f87171", bg: "rgba(239,68,68,0.14)",    border: "rgba(239,68,68,0.30)",   emoji: "🔴" },
  markdown:             { color: "#94a3b8", bg: "rgba(148,163,184,0.08)",  border: "rgba(148,163,184,0.20)", emoji: "📉" },
  transisi:             { color: "#cbd5e1", bg: "rgba(203,213,225,0.07)",  border: "rgba(203,213,225,0.15)", emoji: "🔄" },
};

const FALLBACK_PHASE_META = { color: "#cbd5e1", bg: "rgba(203,213,225,0.07)", border: "rgba(203,213,225,0.15)", emoji: "🔄" };

type EventType = SmartMoneyResult["events"][number]["type"];
const EVENT_META: Record<EventType, { color: string; bg: string }> = {
  supply_exhaustion:    { color: "#e879f9", bg: "rgba(168,85,247,0.10)" },
  obv_price_divergence: { color: "#e879f9", bg: "rgba(168,85,247,0.10)" },
  dry_dip:              { color: "#818cf8", bg: "rgba(99,102,241,0.10)"  },
  range_compression:    { color: "#818cf8", bg: "rgba(99,102,241,0.10)"  },
  quiet_close_high:     { color: "#a78bfa", bg: "rgba(124,58,237,0.10)" },
  down_volume_taper:    { color: "#a78bfa", bg: "rgba(124,58,237,0.10)" },
  stealth_accumulation: { color: "#93c5fd", bg: "rgba(59,130,246,0.10)"  },
  support_bounce:       { color: "#6ee7b7", bg: "rgba(16,185,129,0.10)"  },
  volume_surge_up:      { color: "#fbbf24", bg: "rgba(251,191,36,0.10)"  },
  markup_trigger:       { color: "#fb923c", bg: "rgba(249,115,22,0.10)"  },
  distribution_candle:  { color: "#f87171", bg: "rgba(239,68,68,0.10)"   },
  resistance_rejection: { color: "#f87171", bg: "rgba(239,68,68,0.08)"   },
};

function GaugeBar({ value, color, glow }: { value: number; color: string; glow?: boolean }) {
  const fill = Math.min(value, 100);
  return (
    <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${fill}%`, background: color, boxShadow: glow ? `0 0 8px ${color}` : "none" }} />
    </div>
  );
}

function MetricTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.07)" }}>
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-bold leading-tight" style={{ color: color || "#e2e8f0" }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#fb923c" }}>{title}</p>
      {children}
    </div>
  );
}

export default function AdminSmartMoneyPanel() {
  const [ticker, setTicker] = useState("");
  const [interval, setInterval] = useState<"15m" | "1h" | "4h" | "1d">("1d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SmartMoneyResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "leading" | "chart" | "events" | "cycles" | "habits">("overview");

  const handleAnalyze = async () => {
    if (!ticker.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`/api/admin/smart-money?ticker=${encodeURIComponent(ticker.trim())}&interval=${interval}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analisa gagal");
      setResult(data);
      setActiveTab("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analisa gagal");
    } finally {
      setLoading(false);
    }
  };

  const pm = result ? (PHASE_META[result.currentPhase] ?? FALLBACK_PHASE_META) : null;

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="rounded-3xl p-5 sm:p-6" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(251,146,60,0.08) 100%)", border: "1px solid rgba(168,85,247,0.20)" }}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>🧠</div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Smart Money Behavior Engine</h2>
            <p className="text-sm text-slate-400 mt-1">
              Deteksi sinyal <span style={{ color: "#e879f9" }}>sebelum</span> volume besar dan harga naik tinggi datang — supply exhaustion, OBV divergence, dry dips, range compression.
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input type="text" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
            placeholder="Ticker, contoh: BBCA atau GOTO"
            className="flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(226,232,240,0.12)", color: "#e2e8f0" }}
          />
          <select 
            value={interval} 
            onChange={e => setInterval(e.target.value as any)}
            className="rounded-xl px-4 py-3 text-sm font-bold outline-none cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(226,232,240,0.12)", color: "#e2e8f0" }}
          >
            <option value="15m" className="bg-slate-900">15 Menit</option>
            <option value="1h" className="bg-slate-900">1 Jam</option>
            <option value="4h" className="bg-slate-900">4 Jam</option>
            <option value="1d" className="bg-slate-900">Daily</option>
          </select>
          <button onClick={handleAnalyze} disabled={loading || !ticker.trim()}
            className="px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ background: "rgba(168,85,247,0.20)", color: "#e879f9", border: "1px solid rgba(168,85,247,0.35)" }}>
            {loading ? "Membaca..." : "Analisa Sekarang"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-3xl p-10 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.07)" }}>
          <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Membaca data 400 hari {ticker}...</p>
          <p className="text-xs text-slate-600 mt-1">Biasanya 5–15 detik</p>
        </div>
      )}

      {result && pm && (
        <div className="space-y-5">

          {/* Phase + Pre-Markup Score */}
          <div className="rounded-3xl p-5" style={{ background: pm.bg, border: `1px solid ${pm.border}` }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{pm.emoji}</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: pm.color }}>Fase Saat Ini</p>
                  <p className="text-xl font-bold text-slate-100 mt-0.5">{result.currentPhaseLabel}</p>
                  <p className="text-sm text-slate-300 mt-1 max-w-md">{result.currentPhaseSummary}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black" style={{ color: pm.color }}>{result.name || result.ticker.replace(".JK", "")}</p>
                <p className="text-sm text-slate-300">Rp {result.price.toLocaleString("id-ID")}</p>
                <p className="text-xs mt-0.5" style={{ color: result.changePercent >= 0 ? "#6ee7b7" : "#f87171" }}>
                  {result.changePercent >= 0 ? "+" : ""}{result.changePercent.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs text-slate-400">🎯 Pre-Markup Score</p>
                  <p className="text-sm font-bold" style={{ color: result.preMarkupScore >= 60 ? "#e879f9" : result.preMarkupScore >= 35 ? "#fbbf24" : "#94a3b8" }}>
                    {result.preMarkupScore}/100
                  </p>
                </div>
                <GaugeBar value={result.preMarkupScore}
                  color={result.preMarkupScore >= 60 ? "#e879f9" : result.preMarkupScore >= 35 ? "#fbbf24" : "#64748b"}
                  glow={result.preMarkupScore >= 60} />
                <p className="text-[10px] text-slate-500 mt-1">
                  {result.preMarkupScore >= 60 ? "Mayoritas sinyal leading aktif — sebelum publik sadar" : result.preMarkupScore >= 35 ? "Beberapa sinyal leading mulai menyala" : "Sinyal leading belum signifikan"}
                </p>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs text-slate-400">Kesiapan Markup</p>
                  <p className="text-sm font-bold" style={{ color: pm.color }}>{result.readinessScore}%</p>
                </div>
                <GaugeBar value={result.readinessScore} color={pm.color} />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-xs text-slate-400">Keyakinan Analisa</p>
                  <p className="text-sm font-bold text-slate-300">{result.conviction}%</p>
                </div>
                <GaugeBar value={result.conviction} color="rgba(203,213,225,0.6)" />
              </div>
            </div>
          </div>

          {/* Data quality */}
          {result.dataQuality !== "good" && (
            <div className="rounded-2xl px-4 py-3 flex gap-2.5" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.20)" }}>
              <span>⚠️</span>
              <p className="text-xs text-yellow-300">
                {result.dataQuality === "limited" ? "Data histori terbatas (<120 hari). Pola mungkin kurang akurat." : "Data sangat terbatas. Hasil bersifat indikatif."}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["overview", "leading", "chart", "events", "cycles", "habits"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: activeTab === tab ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.04)",
                  color: activeTab === tab ? "#e879f9" : "#94a3b8",
                  border: `1px solid ${activeTab === tab ? "rgba(168,85,247,0.35)" : "rgba(226,232,240,0.07)"}`,
                }}>
                {tab === "overview" ? "📊 Overview" : tab === "leading" ? "🎯 Pre-Markup" : tab === "chart" ? "📈 Chart" : tab === "events" ? "📅 Event" : tab === "cycles" ? "🔄 Siklus" : "🔍 Kebiasaan"}
              </button>
            ))}
          </div>

          {/* Tab: Chart */}
          {activeTab === "chart" && (
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <p className="text-xs text-purple-300">
                  Chart 120 hari terakhir dengan <strong>event markers</strong> (● = sinyal leading pra-markup, ■ = sudah terjadi) dan <strong>garis siklus</strong> per fase. OBV di bawah — perhatikan apakah OBV naik saat harga flat (divergensi kunci).
                </p>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(168,85,247,0.15)" }}>
                <SmartMoneyChart
                  chartData={result.chartData}
                  events={result.events}
                  cycles={result.cycles}
                  ticker={result.ticker}
                />
              </div>
            </div>
          )}

          {/* Tab: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <Section title="Indikator Leading">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetricTile label="Sell Volume Trend"
                    value={result.metrics.sellVolumeTrend === "drying" ? "🔻 Mengering" : result.metrics.sellVolumeTrend === "rising" ? "🔺 Membesar" : "↔️ Stabil"}
                    color={result.metrics.sellVolumeTrend === "drying" ? "#e879f9" : result.metrics.sellVolumeTrend === "rising" ? "#f87171" : "#94a3b8"}
                    sub="Tren volume hari turun" />
                  <MetricTile label="OBV-Price Divergence"
                    value={result.metrics.obvPriceDivergence ? "✅ Aktif" : "❌ Tidak ada"}
                    color={result.metrics.obvPriceDivergence ? "#e879f9" : "#64748b"}
                    sub="OBV naik saat harga flat" />
                  <MetricTile label="Range Compression"
                    value={result.metrics.rangeCompressionPct !== null ? `${result.metrics.rangeCompressionPct.toFixed(0)}%` : "–"}
                    color={result.metrics.rangeCompressionPct !== null && result.metrics.rangeCompressionPct < 60 ? "#e879f9" : "#94a3b8"}
                    sub="Range 5H vs 10H sebelumnya (<60% = compressed)" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricTile label="Profil Volume Terkini"
                    value={result.metrics.recentVolumeProfile === "accumulation" ? "📈 Akumulasi" : result.metrics.recentVolumeProfile === "distribution" ? "📉 Distribusi" : "↔️ Netral"}
                    color={result.metrics.recentVolumeProfile === "accumulation" ? "#6ee7b7" : result.metrics.recentVolumeProfile === "distribution" ? "#f87171" : "#94a3b8"} />
                  <MetricTile label="Stealth Score" value={`${result.metrics.stealthScore}%`}
                    sub="Seberapa senyap akumulasinya"
                    color={result.metrics.stealthScore >= 40 ? "#93c5fd" : "#94a3b8"} />
                  <MetricTile label="Supply Absorbed" value={result.metrics.supplyAbsorptionRate !== null ? `${result.metrics.supplyAbsorptionRate}%` : "–"}
                    sub="OBV+AD naik 20H"
                    color={result.metrics.supplyAbsorptionRate !== null && result.metrics.supplyAbsorptionRate >= 55 ? "#6ee7b7" : "#94a3b8"} />
                  <MetricTile label="Rata-rata Akumulasi" value={result.metrics.avgAccumulationDays !== null ? `${result.metrics.avgAccumulationDays} hari` : "–"}
                    sub="Sebelum markup biasanya" />
                </div>
              </Section>

              <Section title="Rekomendasi">
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.07)" }}>
                  <p className="text-sm text-slate-200 leading-relaxed">{result.recommendation}</p>
                </div>
              </Section>

              {result.stockSummaryInsight && (
                <Section title="Pendukung: Stock Summary">
                  <div className="rounded-2xl p-4 flex gap-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}>
                    <span>📋</span>
                    <p className="text-sm text-emerald-200 leading-relaxed">{result.stockSummaryInsight}</p>
                  </div>
                </Section>
              )}

              {result.warnings.length > 0 && (
                <Section title="Peringatan">
                  <div className="space-y-2">
                    {result.warnings.map((w, i) => (
                      <div key={i} className="rounded-xl px-4 py-2.5 flex gap-2.5" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
                        <span>⚠️</span><p className="text-xs text-red-300">{w}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Tab: Pre-Markup Signals */}
          {activeTab === "leading" && (
            <div className="space-y-4">
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.20)" }}>
                <p className="text-xs text-purple-300 leading-relaxed">
                  <span className="font-bold">🎯 Sinyal pra-markup</span> — ini adalah indikator yang biasanya terdeteksi <span className="font-bold">sebelum</span> volume besar dan kenaikan harga yang terlihat. Semakin banyak yang aktif (✅), semakin dekat window akumulasi berakhir.
                </p>
              </div>
              <div className="flex justify-between items-center px-1">
                <p className="text-xs text-slate-500">{result.preMarkupSignals.filter(s => s.active).length} dari {result.preMarkupSignals.length} sinyal aktif</p>
                <p className="text-sm font-bold" style={{ color: result.preMarkupScore >= 60 ? "#e879f9" : result.preMarkupScore >= 35 ? "#fbbf24" : "#94a3b8" }}>
                  Total: {result.preMarkupScore}/100
                </p>
              </div>
              {result.preMarkupSignals.map((sig, i) => (
                <div key={i} className="rounded-2xl p-4 space-y-2"
                  style={{
                    background: sig.active ? "rgba(168,85,247,0.10)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${sig.active ? "rgba(168,85,247,0.30)" : "rgba(226,232,240,0.07)"}`,
                  }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{sig.active ? "✅" : "⬜"}</span>
                      <p className="text-sm font-bold" style={{ color: sig.active ? "#e879f9" : "#64748b" }}>{sig.name}</p>
                    </div>
                    {sig.active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(168,85,247,0.20)", color: "#e879f9" }}>
                        +{sig.score} poin
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: sig.active ? "#cbd5e1" : "#64748b" }}>{sig.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Events */}
          {activeTab === "events" && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span style={{ color: "#e879f9" }}>●</span> Sinyal leading (sebelum markup)</span>
                <span className="flex items-center gap-1"><span style={{ color: "#94a3b8" }}>●</span> Sudah terjadi</span>
              </div>
              {result.events.length === 0 && (
                <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.07)" }}>
                  <p className="text-sm text-slate-500">Tidak ada event terdeteksi.</p>
                </div>
              )}
              {result.events.map((ev, i) => {
                const m = EVENT_META[ev.type] || { color: "#94a3b8", bg: "rgba(255,255,255,0.03)" };
                return (
                  <div key={i} className="flex gap-3 rounded-2xl p-4" style={{ background: m.bg, border: `1px solid ${m.color}33` }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: m.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold" style={{ color: m.color }}>{ev.label}</span>
                        {ev.isLeading && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(168,85,247,0.20)", color: "#e879f9" }}>LEADING</span>}
                        <span className="text-[10px] text-slate-500">{ev.date}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                          Vol {ev.relVolume.toFixed(1)}x
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{ev.detail}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Rp {ev.price.toLocaleString("id-ID")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Cycles */}
          {activeTab === "cycles" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{result.cycles.length} siklus terdeteksi dari pivot harga (terbaru di bawah)</p>
              {result.cycles.length === 0 && (
                <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.07)" }}>
                  <p className="text-sm text-slate-500">Data tidak cukup untuk mendeteksi siklus.</p>
                </div>
              )}
              {[...result.cycles].reverse().map((cycle, i) => {
                const m = PHASE_META[cycle.phase];
                return (
                  <div key={i} className="rounded-2xl p-4" style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold" style={{ color: m.color }}>{cycle.phaseLabel}</span>
                          <span className="text-[10px] text-slate-500">{cycle.durationDays} hari</span>
                        </div>
                        <p className="text-xs text-slate-400">{cycle.startDate} → {cycle.endDate}</p>
                        <p className="text-xs text-slate-300 mt-1.5">{cycle.keyEvent}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: cycle.changePct >= 0 ? "#6ee7b7" : "#f87171" }}>{pct(cycle.changePct)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Rp {num(cycle.priceStart)} → {num(cycle.priceEnd)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Habits */}
          {activeTab === "habits" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Kebiasaan berulang yang teridentifikasi dari rekam jejak historis emiten ini</p>
              {result.habits.length === 0 && (
                <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.07)" }}>
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-sm text-slate-400">Belum ada kebiasaan yang cukup jelas. Data histori lebih panjang akan menghasilkan deteksi lebih akurat.</p>
                </div>
              )}
              {result.habits.map((habit, i) => (
                <div key={i} className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.08)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-bold text-slate-100">{habit.pattern}</p>
                    <span className="text-[10px] px-2 py-0.5 font-semibold rounded-full" style={{ background: "rgba(168,85,247,0.16)", color: "#e879f9" }}>
                      {habit.occurrences}× terdeteksi
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{habit.description}</p>
                  <div className="rounded-xl px-3 py-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <p className="text-[11px] text-emerald-300 leading-relaxed">💡 {habit.implication}</p>
                  </div>
                  <p className="text-[10px] text-slate-600">Terakhir: {habit.lastSeen}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="rounded-3xl p-10 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-slate-300 font-semibold">Masukkan ticker untuk deteksi pra-markup</p>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
            Engine akan mendeteksi 6 sinyal leading yang biasanya muncul <strong className="text-purple-400">sebelum</strong> volume besar dan harga naik tinggi: supply exhaustion, OBV divergence, dry dip, range compression, quiet close near high, dan down-volume taper.
          </p>
        </div>
      )}
    </div>
  );
}
