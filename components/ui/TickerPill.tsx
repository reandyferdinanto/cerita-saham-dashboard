"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { OHLCData, StockQuote } from "@/lib/types";
import GlassCard from "@/components/ui/GlassCard";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart"),
  { ssr: false, loading: () => <div className="h-[320px] flex items-center justify-center"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} /></div> }
);

// ── IDX ticker dictionary — 4-char codes + common name aliases ────────────────
const IDX_ALIASES: Record<string, string> = {
  // Blue chips
  "BBCA": "BBCA.JK", "BCA": "BBCA.JK",
  "BBRI": "BBRI.JK", "BRI": "BBRI.JK",
  "BMRI": "BMRI.JK", "MANDIRI": "BMRI.JK",
  "BBNI": "BBNI.JK", "BNI": "BBNI.JK",
  "TLKM": "TLKM.JK", "TELKOM": "TLKM.JK",
  "ASII": "ASII.JK", "ASTRA": "ASII.JK",
  "UNVR": "UNVR.JK", "UNILEVER": "UNVR.JK",
  "GOTO": "GOTO.JK",
  "BREN": "BREN.JK",
  "AMRT": "AMRT.JK", "ALFAMART": "AMRT.JK",
  "ADRO": "ADRO.JK", "ADARO": "ADRO.JK",
  "ANTM": "ANTM.JK", "ANTAM": "ANTM.JK",
  "INDF": "INDF.JK", "INDOFOOD": "INDF.JK",
  "ICBP": "ICBP.JK",
  "KLBF": "KLBF.JK", "KALBE": "KLBF.JK",
  "PGAS": "PGAS.JK", "PGN": "PGAS.JK",
  "PTBA": "PTBA.JK", "BUKIT ASAM": "PTBA.JK",
  "SMGR": "SMGR.JK", "SEMEN INDONESIA": "SMGR.JK",
  "JSMR": "JSMR.JK",
  "EXCL": "EXCL.JK",
  "ISAT": "ISAT.JK", "INDOSAT": "ISAT.JK",
  "CPIN": "CPIN.JK", "CHAROEN": "CPIN.JK",
  "MDKA": "MDKA.JK",
  "TOWR": "TOWR.JK",
  "PWON": "PWON.JK",
  "CTRA": "CTRA.JK", "CIPUTRA": "CTRA.JK",
  "BSDE": "BSDE.JK",
  "SMRA": "SMRA.JK", "SUMMARECON": "SMRA.JK",
  "MNCN": "MNCN.JK",
  "EMTK": "EMTK.JK",
  "DNET": "DNET.JK",
  "MAPI": "MAPI.JK",
  "ACES": "ACES.JK",
  "LSIP": "LSIP.JK",
  "AALI": "AALI.JK",
  "TBIG": "TBIG.JK",
  "HRUM": "HRUM.JK",
  "INCO": "INCO.JK",
  "VALE": "INCO.JK",
  "MEDC": "MEDC.JK", "MEDCO": "MEDC.JK",
  "INTP": "INTP.JK", "INDOCEMENT": "INTP.JK",
  "SIDO": "SIDO.JK",
  "MYOR": "MYOR.JK", "MAYORA": "MYOR.JK",
  "GGRM": "GGRM.JK", "GUDANG GARAM": "GGRM.JK",
  "HMSP": "HMSP.JK", "SAMPOERNA": "HMSP.JK",
  "BNGA": "BNGA.JK", "CIMB": "BNGA.JK",
  "BDMN": "BDMN.JK", "DANAMON": "BDMN.JK",
  "BJTM": "BJTM.JK",
  "BJBR": "BJBR.JK",
  "BNLI": "BNLI.JK", "PERMATA": "BNLI.JK",
  "NISP": "NISP.JK", "OCBC": "NISP.JK",
  "PNBN": "PNBN.JK", "PANIN": "PNBN.JK",
  "LIFE": "LIFE.JK",
  "BFIN": "BFIN.JK",
  "SRTG": "SRTG.JK",
  "JPFA": "JPFA.JK",
  "TBLA": "TBLA.JK",
  "PALM": "PALM.JK",
  "SSMS": "SSMS.JK",
  "DSNG": "DSNG.JK",
  "SIMP": "SIMP.JK",
  "UNSP": "UNSP.JK",
  "TAPG": "TAPG.JK",
};

// ── Extract tickers mentioned in text ─────────────────────────────────────────
export function extractTickers(text: string): { ticker: string; fullTicker: string; start: number; end: number }[] {
  const found: { ticker: string; fullTicker: string; start: number; end: number }[] = [];
  const seen = new Set<string>();

  // 1. Explicit pattern: "(BBCA)" or "BBCA.JK"
  const explicitRe = /\b([A-Z]{3,5})(?:\.JK)?\b/g;
  let m: RegExpExecArray | null;
  while ((m = explicitRe.exec(text)) !== null) {
    const code = m[1];
    const fullTicker = IDX_ALIASES[code];
    if (fullTicker && !seen.has(code)) {
      seen.add(code);
      found.push({ ticker: code, fullTicker, start: m.index, end: m.index + m[0].length });
    }
  }

  // 2. Name aliases (multi-word, case-insensitive)
  const upperText = text.toUpperCase();
  for (const [alias, fullTicker] of Object.entries(IDX_ALIASES)) {
    if (alias.length <= 4) continue; // skip short codes already covered
    const idx = upperText.indexOf(alias);
    if (idx !== -1) {
      const code = fullTicker.replace(".JK", "");
      if (!seen.has(code)) {
        seen.add(code);
        found.push({ ticker: code, fullTicker, start: idx, end: idx + alias.length });
      }
    }
  }

  return found;
}

// ── Timeframe config ──────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { label: "5m",  range: "1d",  interval: "5m"  },
  { label: "15m", range: "5d",  interval: "15m" },
  { label: "1h",  range: "5d",  interval: "1h"  },
  { label: "1D",  range: "1y",  interval: "1d"  },
  { label: "1W",  range: "1y",  interval: "1wk" },
];

// ── TickerPill component ──────────────────────────────────────────────────────
interface TickerPillProps {
  ticker: string;
  fullTicker: string;
  onOpen: (ticker: string, fullTicker: string) => void;
}

export function TickerPill({ ticker, fullTicker, onOpen }: TickerPillProps) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(ticker, fullTicker); }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all mx-0.5 align-middle"
      style={{
        background: "rgba(249,115,22,0.15)",
        color: "#fb923c",
        border: "1px solid rgba(249,115,22,0.3)",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.28)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(249,115,22,0.15)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.3)"; }}
      title={`Lihat chart ${fullTicker}`}
    >
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
      </svg>
      {ticker}
    </button>
  );
}

// ── Render title with inline TickerPills ──────────────────────────────────────
interface TitleWithPillsProps {
  text: string;
  onOpen: (ticker: string, fullTicker: string) => void;
  className?: string;
}

export function TitleWithPills({ text, onOpen, className }: TitleWithPillsProps) {
  const tickers = extractTickers(text);
  if (tickers.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Sort by start position
  const sorted = [...tickers].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;

  sorted.forEach((t, i) => {
    if (t.start > lastIdx) parts.push(text.slice(lastIdx, t.start));
    parts.push(
      <TickerPill key={i} ticker={t.ticker} fullTicker={t.fullTicker} onOpen={onOpen} />
    );
    lastIdx = t.end;
  });
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return <span className={className}>{parts}</span>;
}

// ── StockQuickModal ────────────────────────────────────────────────────────���──
interface StockQuickModalProps {
  ticker: string;       // e.g. "BBCA"
  fullTicker: string;   // e.g. "BBCA.JK"
  onClose: () => void;
}

export function StockQuickModal({ ticker, fullTicker, onClose }: StockQuickModalProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [history, setHistory] = useState<OHLCData[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState(TIMEFRAMES[3]); // default 1D
  const overlayRef = useRef<HTMLDivElement>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(fullTicker)}`);
      const data = await res.json();
      if (!data.error) setQuote(data);
    } catch { /* silent */ }
    finally { setLoadingQuote(false); }
  }, [fullTicker]);

  const fetchChart = useCallback(async (tf: typeof TIMEFRAMES[0], livePrice?: number) => {
    setLoadingChart(true);
    try {
      const res = await fetch(`/api/stocks/history/${encodeURIComponent(fullTicker)}?range=${tf.range}&interval=${tf.interval}`);
      const raw: OHLCData[] = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        if (livePrice != null && livePrice > 0) {
          const last = { ...raw[raw.length - 1] };
          last.close = livePrice;
          last.high = Math.max(last.high, livePrice);
          last.low = Math.min(last.low, livePrice);
          raw[raw.length - 1] = last;
        }
        setHistory(raw.filter(d => d.close != null));
      }
    } catch { /* silent */ }
    finally { setLoadingChart(false); }
  }, [fullTicker]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    fetchChart(activeTimeframe, quote?.price);
  }, [activeTimeframe, fetchChart, quote?.price]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: "rgba(6,20,15,0.98)", border: "1px solid rgba(16,185,129,0.15)", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 z-10"
          style={{ background: "rgba(6,20,15,0.98)", borderBottom: "1px solid rgba(226,232,240,0.06)" }}>
          {/* Drag handle (mobile) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full sm:hidden"
            style={{ background: "rgba(255,255,255,0.12)" }} />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <span className="text-xs font-bold" style={{ color: "#fb923c" }}>{ticker.slice(0, 4)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold" style={{ color: "#f1f5f9" }}>{ticker}<span className="text-sm font-normal" style={{ color: "#475569" }}>.JK</span></h3>
                {!loadingQuote && quote && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
                    style={{
                      background: isPositive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: isPositive ? "#10b981" : "#f87171",
                      border: `1px solid ${isPositive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                    }}>
                    {isPositive ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
                  </span>
                )}
              </div>
              {quote && <p className="text-xs truncate max-w-[200px]" style={{ color: "#64748b" }}>{quote.name}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Open full page */}
            <a href={`/stock/${encodeURIComponent(fullTicker)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)" }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Detail
            </a>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#e2e8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#64748b"; }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 space-y-4 mt-2">
          {/* Price + stats */}
          {loadingQuote ? (
            <div className="flex gap-3">
              {[1,2,3,4].map(i => <div key={i} className="flex-1 h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />)}
            </div>
          ) : quote ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: "#f1f5f9" }}>
                    {quote.price.toLocaleString("id-ID")}
                  </p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: isPositive ? "#10b981" : "#f87171" }}>
                    {isPositive ? "+" : ""}{change.toFixed(0)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)
                  </p>
                </div>
                {quote.marketCap && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>Market Cap</p>
                    <p className="text-sm font-bold" style={{ color: "#94a3b8" }}>
                      Rp {(quote.marketCap / 1_000_000_000_000).toFixed(2)}T
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Open",  value: quote.open.toLocaleString("id-ID") },
                  { label: "High",  value: quote.high.toLocaleString("id-ID") },
                  { label: "Low",   value: quote.low.toLocaleString("id-ID")  },
                  { label: "Vol",   value: `${(quote.volume / 1_000_000).toFixed(1)}M` },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
                    <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "#475569" }}>{s.label}</p>
                    <p className="text-xs font-bold tabular-nums" style={{ color: "#cbd5e1" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* Timeframe picker */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {TIMEFRAMES.map(tf => (
              <button key={tf.label} onClick={() => setActiveTimeframe(tf)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                style={activeTimeframe.label === tf.label
                  ? { background: "rgba(249,115,22,0.18)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(226,232,240,0.06)" }}>
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <GlassCard hover={false} className="!p-3">
            {loadingChart ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(251,146,60,0.2)", borderTopColor: "#fb923c" }} />
              </div>
            ) : history.length > 0 ? (
              <CandlestickChart data={history} height={280} mobileHeight={220} />
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-xs" style={{ color: "#334155" }}>Data tidak tersedia</p>
              </div>
            )}
          </GlassCard>

          {/* Cari saham link */}
          <a href={`/search?q=${ticker}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.15)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Lihat analisa lengkap di Cari Saham
          </a>
        </div>
      </div>
    </div>
  );
}

