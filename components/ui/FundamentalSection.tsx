"use client";

import { useState } from "react";
import GlassCard from "@/components/ui/GlassCard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FundamentalData {
  valuation: {
    marketCap: number | null; enterpriseValue: number | null;
    trailingPE: number | null; forwardPE: number | null;
    priceToBook: number | null; priceToSales: number | null;
    evToRevenue: number | null; evToEbitda: number | null;
    beta: number | null; dividendYield: number | null;
    payoutRatio: number | null;
    fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null;
  } | null;
  financials: {
    revenue: number | null; revenueGrowth: number | null;
    grossMargin: number | null; ebitda: number | null;
    netIncome: number | null; profitMargin: number | null;
    operatingMargin: number | null; roe: number | null;
    roa: number | null; debtToEquity: number | null;
    currentRatio: number | null; freeCashflow: number | null;
    earningsGrowth: number | null;
  } | null;
  profile: {
    longName: string | null; sector: string | null;
    industry: string | null; website: string | null;
    longBusinessSummary: string | null; country: string | null;
    city: string | null; fullTimeEmployees: number | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBig(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  return v.toLocaleString();
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}
function fmtX(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(2)}x`;
}
function fmtNum(v: number | null, dec = 2): string {
  if (v == null) return "—";
  return v.toFixed(dec);
}

// Color for margin/return metrics
function metricColor(v: number | null): string {
  if (v == null) return "#64748b";
  if (v > 0.20) return "#10b981";
  if (v > 0.08) return "#6ee7b7";
  if (v > 0)    return "#f59e0b";
  return "#f87171";
}

// ── Expandable Panel ──────────────────────────────────────────────────────────
function Panel({
  title, icon, iconColor, iconBg, defaultOpen = false, children,
}: {
  title: string; icon: React.ReactNode; iconColor: string; iconBg: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(226,232,240,0.08)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-all"
        style={{ background: open ? "rgba(6,20,15,0.6)" : "rgba(6,20,15,0.35)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg, border: `1px solid ${iconColor}30` }}>
            <span style={{ color: iconColor }}>{icon}</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{title}</span>
        </div>
        <svg
          className="w-4 h-4 transition-transform duration-200 flex-shrink-0"
          style={{ color: "#475569", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ background: "rgba(6,20,15,0.2)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Metric Row ────────────────────────────────────────────────────────────────
function MetricRow({ label, value, valueColor, hint }: { label: string; value: string; valueColor?: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: "1px solid rgba(226,232,240,0.04)" }}>
      <div>
        <span className="text-xs" style={{ color: "#64748b" }}>{label}</span>
        {hint && <span className="text-[10px] ml-1" style={{ color: "#334155" }}>({hint})</span>}
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: valueColor ?? "#cbd5e1" }}>{value}</span>
    </div>
  );
}

// ── Metric Grid Card ──────────────────────────────────────────────────────────
function MetricCard({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
      <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#475569" }}>{label}</p>
      <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: valueColor ?? "#cbd5e1" }}>{value}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: "#334155" }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FundamentalSection({
  fundamental, loading,
}: {
  fundamental: FundamentalData | null;
  loading: boolean;
}) {
  const hasAny = fundamental?.valuation || fundamental?.financials || fundamental?.profile;

  return (
    <GlassCard hover={false}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <svg className="w-4 h-4" style={{ color: "#fbbf24" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
            Fundamental & <span style={{ color: "#fbbf24" }}>Metrik Valuasi</span>
          </h3>
          <p className="text-[10px]" style={{ color: "#475569" }}>Profil perusahaan, valuasi, dan kinerja keuangan</p>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      )}

      {/* No data */}
      {!loading && !hasAny && (
        <p className="text-xs text-center py-6" style={{ color: "#334155" }}>
          Data fundamental tidak tersedia untuk saham ini
        </p>
      )}

      {/* Content */}
      {!loading && hasAny && (
        <div className="space-y-2">

          {/* ── Profil Perusahaan ── */}
          {fundamental?.profile && (
            <Panel
              title="Profil Perusahaan"
              defaultOpen={true}
              iconColor="#3b82f6"
              iconBg="rgba(59,130,246,0.12)"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            >
              {/* Tags row */}
              <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                {fundamental.profile.sector && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}>
                    {fundamental.profile.sector}
                  </span>
                )}
                {fundamental.profile.industry && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.2)" }}>
                    {fundamental.profile.industry}
                  </span>
                )}
                {fundamental.profile.country && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: "rgba(16,185,129,0.10)", color: "#34d399", border: "1px solid rgba(16,185,129,0.18)" }}>
                    {fundamental.profile.city ? `${fundamental.profile.city}, ` : ""}{fundamental.profile.country}
                  </span>
                )}
                {fundamental.profile.fullTimeEmployees != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: "rgba(251,191,36,0.10)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.18)" }}>
                    {fundamental.profile.fullTimeEmployees.toLocaleString()} karyawan
                  </span>
                )}
              </div>

              {/* Website */}
              {fundamental.profile.website && (
                <a href={fundamental.profile.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs mb-3 transition-colors hover:text-blue-400"
                  style={{ color: "#3b82f6" }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {fundamental.profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}

              {/* Business summary */}
              {fundamental.profile.longBusinessSummary && (
                <BusinessSummary text={fundamental.profile.longBusinessSummary} />
              )}
            </Panel>
          )}

          {/* ── Valuasi ── */}
          {fundamental?.valuation && (
            <Panel
              title="Valuasi & Metrik Pasar"
              defaultOpen={true}
              iconColor="#fbbf24"
              iconBg="rgba(251,191,36,0.12)"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              {/* Top grid — key valuations */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 mb-3">
                <MetricCard label="Market Cap" value={fmtBig(fundamental.valuation.marketCap)} valueColor="#fbbf24" />
                <MetricCard label="Enterprise Value" value={fmtBig(fundamental.valuation.enterpriseValue)} />
                <MetricCard label="Trailing P/E" value={fmtX(fundamental.valuation.trailingPE)}
                  valueColor={fundamental.valuation.trailingPE != null ? (fundamental.valuation.trailingPE < 15 ? "#10b981" : fundamental.valuation.trailingPE < 30 ? "#f59e0b" : "#f87171") : undefined} />
                <MetricCard label="Forward P/E" value={fmtX(fundamental.valuation.forwardPE)}
                  valueColor={fundamental.valuation.forwardPE != null ? (fundamental.valuation.forwardPE < 15 ? "#10b981" : fundamental.valuation.forwardPE < 30 ? "#f59e0b" : "#f87171") : undefined} />
              </div>

              {/* Rows */}
              <div className="space-y-0">
                <MetricRow label="Price to Book (PBV)"   value={fmtX(fundamental.valuation.priceToBook)} hint="< 1 = undervalue" />
                <MetricRow label="Price to Sales (P/S)"  value={fmtX(fundamental.valuation.priceToSales)} />
                <MetricRow label="EV / Revenue"          value={fmtX(fundamental.valuation.evToRevenue)} />
                <MetricRow label="EV / EBITDA"           value={fmtX(fundamental.valuation.evToEbitda)} hint="< 10 = murah" />
                <MetricRow label="Beta"                  value={fmtNum(fundamental.valuation.beta)}
                  valueColor={fundamental.valuation.beta != null ? (fundamental.valuation.beta > 1.5 ? "#f87171" : fundamental.valuation.beta > 1 ? "#f59e0b" : "#10b981") : undefined}
                  hint="volatilitas vs market" />
                <MetricRow label="Dividend Yield"        value={fmtPct(fundamental.valuation.dividendYield)} valueColor="#10b981" />
                <MetricRow label="Payout Ratio"          value={fmtPct(fundamental.valuation.payoutRatio)} />
                <MetricRow label="52W High"              value={fundamental.valuation.fiftyTwoWeekHigh?.toLocaleString("id-ID") ?? "—"} valueColor="#10b981" />
                <MetricRow label="52W Low"               value={fundamental.valuation.fiftyTwoWeekLow?.toLocaleString("id-ID") ?? "—"} valueColor="#f87171" />
              </div>
            </Panel>
          )}

          {/* ── Kinerja Keuangan ── */}
          {fundamental?.financials && (
            <Panel
              title="Kinerja Keuangan"
              defaultOpen={true}
              iconColor="#10b981"
              iconBg="rgba(16,185,129,0.12)"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            >
              {/* Top grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 mb-3">
                <MetricCard label="Revenue" value={fmtBig(fundamental.financials.revenue)} />
                <MetricCard label="EBITDA" value={fmtBig(fundamental.financials.ebitda)} />
                <MetricCard label="Net Income" value={fmtBig(fundamental.financials.netIncome)}
                  valueColor={fundamental.financials.netIncome != null ? (fundamental.financials.netIncome > 0 ? "#10b981" : "#f87171") : undefined} />
                <MetricCard label="Free Cash Flow" value={fmtBig(fundamental.financials.freeCashflow)}
                  valueColor={fundamental.financials.freeCashflow != null ? (fundamental.financials.freeCashflow > 0 ? "#10b981" : "#f87171") : undefined} />
              </div>

              {/* Margin rows with color bars */}
              <div className="space-y-0">
                {[
                  { label: "Profit Margin",     value: fundamental.financials.profitMargin },
                  { label: "Gross Margin",      value: fundamental.financials.grossMargin },
                  { label: "Operating Margin",  value: fundamental.financials.operatingMargin },
                  { label: "ROE (Return on Equity)", value: fundamental.financials.roe },
                  { label: "ROA (Return on Assets)", value: fundamental.financials.roa },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: "1px solid rgba(226,232,240,0.04)" }}>
                    <span className="text-xs" style={{ color: "#64748b" }}>{label}</span>
                    <div className="flex items-center gap-2">
                      {value != null && (
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(Math.abs(value) * 100 * 2, 100)}%`,
                            background: metricColor(value),
                          }} />
                        </div>
                      )}
                      <span className="text-xs font-semibold tabular-nums w-14 text-right"
                        style={{ color: metricColor(value) }}>
                        {fmtPct(value)}
                      </span>
                    </div>
                  </div>
                ))}

                <MetricRow label="Revenue Growth (YoY)"  value={fmtPct(fundamental.financials.revenueGrowth)}
                  valueColor={fundamental.financials.revenueGrowth != null ? (fundamental.financials.revenueGrowth > 0 ? "#10b981" : "#f87171") : undefined} />
                <MetricRow label="Earnings Growth (YoY)" value={fmtPct(fundamental.financials.earningsGrowth)}
                  valueColor={fundamental.financials.earningsGrowth != null ? (fundamental.financials.earningsGrowth > 0 ? "#10b981" : "#f87171") : undefined} />
                <MetricRow label="Debt to Equity"        value={fmtNum(fundamental.financials.debtToEquity)}
                  valueColor={fundamental.financials.debtToEquity != null ? (fundamental.financials.debtToEquity < 1 ? "#10b981" : fundamental.financials.debtToEquity < 2 ? "#f59e0b" : "#f87171") : undefined}
                  hint="< 1 = sehat" />
                <MetricRow label="Current Ratio"         value={fmtNum(fundamental.financials.currentRatio)}
                  valueColor={fundamental.financials.currentRatio != null ? (fundamental.financials.currentRatio > 1.5 ? "#10b981" : fundamental.financials.currentRatio > 1 ? "#f59e0b" : "#f87171") : undefined}
                  hint="> 1.5 = likuid" />
              </div>
            </Panel>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ── Expandable business summary ───────────────────────────────────────────────
function BusinessSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const SHORT_LEN = 220;
  const isLong = text.length > SHORT_LEN;
  const display = expanded || !isLong ? text : text.slice(0, SHORT_LEN) + "…";

  return (
    <div>
      <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{display}</p>
      {isLong && (
        <button onClick={() => setExpanded(e => !e)}
          className="text-[10px] font-semibold mt-1.5 transition-colors hover:text-orange-400"
          style={{ color: "#fb923c" }}>
          {expanded ? "Sembunyikan ▲" : "Baca selengkapnya ▼"}
        </button>
      )}
    </div>
  );
}

