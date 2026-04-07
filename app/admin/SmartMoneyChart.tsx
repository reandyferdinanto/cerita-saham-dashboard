"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from "lightweight-charts";
import type {
  ChartBar,
  SmartMoneyEvent,
  SmartMoneyCycle,
  SmartMoneyPhase,
} from "@/lib/smartMoneyEngine";

interface Props {
  chartData: ChartBar[];
  events: SmartMoneyEvent[];
  cycles: SmartMoneyCycle[];
  ticker: string;
}

// Color map for event types
const EVENT_COLOR: Record<string, string> = {
  supply_exhaustion:    "#e879f9",
  obv_price_divergence: "#c084fc",
  dry_dip:              "#818cf8",
  range_compression:    "#818cf8",
  quiet_close_high:     "#a78bfa",
  down_volume_taper:    "#a78bfa",
  stealth_accumulation: "#60a5fa",
  support_bounce:       "#34d399",
  volume_surge_up:      "#fbbf24",
  markup_trigger:       "#fb923c",
  distribution_candle:  "#f87171",
  resistance_rejection: "#f87171",
};

const PHASE_LINE_COLOR: Record<SmartMoneyPhase, string> = {
  akumulasi_awal:       "#3b82f6",
  akumulasi_aktif:      "#10b981",
  pre_markup:           "#a855f7",
  markup_siap:          "#eab308",
  markup_berlangsung:   "#f97316",
  distribusi_persiapan: "#ef4444",
  distribusi_aktif:     "#dc2626",
  markdown:             "#64748b",
  transisi:             "#475569",
};

export default function SmartMoneyChart({ chartData, events, cycles, ticker }: Props) {
  const priceRef = useRef<HTMLDivElement>(null);
  const obvRef   = useRef<HTMLDivElement>(null);
  const chartA   = useRef<IChartApi | null>(null);
  const chartB   = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!priceRef.current || !obvRef.current || chartData.length === 0) return;

    // ── Shared chart options ──────────────────────────────────────────────
    const sharedOpts = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(226,232,240,0.04)" },
        horzLines: { color: "rgba(226,232,240,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(168,85,247,0.30)", labelBackgroundColor: "#3b0764" },
        horzLine: { color: "rgba(168,85,247,0.30)", labelBackgroundColor: "#3b0764" },
      },
      rightPriceScale: { borderColor: "rgba(226,232,240,0.08)" },
      timeScale: {
        borderColor: "rgba(226,232,240,0.08)",
        timeVisible: false,
        secondsVisible: false,
      },
    };

    // ── Price + Volume + Events chart (top) ───────────────────────────────
    const ca = createChart(priceRef.current, {
      ...sharedOpts,
      width: priceRef.current.clientWidth,
      height: 340,
    });
    chartA.current = ca;

    // Price scale layout: price top 68%, volume bottom 18%
    ca.priceScale("right").applyOptions({ scaleMargins: { top: 0.02, bottom: 0.22 } });

    // Candlestick
    const candleSeries = ca.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444",
      borderUpColor: "#10b981", borderDownColor: "#ef4444",
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    });
    candleSeries.setData(chartData.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })) as any);

    // Volume bars
    const volSeries = ca.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    ca.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volSeries.setData(chartData.map(b => ({
      time: b.time,
      value: b.volume,
      color: b.close >= b.open ? "rgba(16,185,129,0.30)" : "rgba(239,68,68,0.30)",
    })) as any);

    // MA20 and MA50 on price chart
    const calcMA = (period: number) => {
      const result: { time: string; value: number }[] = [];
      for (let i = period - 1; i < chartData.length; i++) {
        const sum = chartData.slice(i - period + 1, i + 1).reduce((s, b) => s + b.close, 0);
        result.push({ time: chartData[i].time, value: Math.round(sum / period) });
      }
      return result;
    };
    if (chartData.length >= 20) {
      ca.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        .setData(calcMA(20) as any);
    }
    if (chartData.length >= 50) {
      ca.addSeries(LineSeries, { color: "#a855f7", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        .setData(calcMA(50) as any);
    }

    // ── Event markers on price chart ─────────────────────────────────────
    const dateSet = new Set(chartData.map(b => b.time));
    const markers = events
      .filter(ev => dateSet.has(ev.date))
      .map(ev => {
        const color = EVENT_COLOR[ev.type] || "#94a3b8";
        const isLeading = ev.isLeading;
        return {
          time: ev.date,
          position: (ev.type === "distribution_candle" || ev.type === "resistance_rejection") ? "aboveBar" : "belowBar",
          color,
          shape: isLeading ? "circle" : "square",
          text: isLeading ? "●" : "■",
          size: 0,
        };
      });

    // Deduplicate by date + position
    const seen = new Set<string>();
    const uniqueMarkers = markers.filter(m => {
      const key = `${m.time}__${m.position}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (uniqueMarkers.length > 0) {
      // lightweight-charts v5
      createSeriesMarkers(candleSeries, uniqueMarkers as any);
    }

    // ── Cycle phase label lines on price chart ────────────────────────────
    cycles.forEach(cycle => {
      const color = PHASE_LINE_COLOR[cycle.phase] || "#94a3b8";
      const startInChart = chartData.find(b => b.time >= cycle.startDate);
      const endInChart = chartData.find(b => b.time >= cycle.endDate);
      if (!startInChart) return;
      // Draw a thin price line at the start price of each cycle
      candleSeries.createPriceLine({
        price: cycle.priceStart,
        color: `${color}55`,
        lineWidth: 1,
        lineStyle: 3, // dashed
        axisLabelVisible: false,
        title: cycle.phaseLabel.slice(0, 8),
      });
      // Draw a connecting line segment between start and end of cycle
      if (startInChart && endInChart) {
        const segData = chartData
          .filter(b => b.time >= cycle.startDate && b.time <= cycle.endDate)
          .map(b => ({ time: b.time, value: cycle.priceStart }));
        if (segData.length >= 2) {
          ca.addSeries(LineSeries, {
            color: `${color}44`,
            lineWidth: 2,
            lineStyle: 3,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }).setData(segData as any);
        }
      }
    });

    // ── OBV chart (bottom) ────────────────────────────────────────────────
    const cb = createChart(obvRef.current, {
      ...sharedOpts,
      width: obvRef.current.clientWidth,
      height: 120,
      timeScale: { ...sharedOpts.timeScale, visible: true },
    });
    chartB.current = cb;

    cb.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });

    // OBV area line
    const obvSeries = cb.addSeries(LineSeries, {
      color: "#e879f9",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 3,
    });
    obvSeries.setData(chartData.map(b => ({ time: b.time, value: b.obv })) as any);

    // OBV zero line baseline
    cb.addSeries(LineSeries, {
      color: "rgba(168,85,247,0.15)", lineWidth: 1, lineStyle: 3,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }).setData([
      { time: chartData[0].time, value: 0 },
      { time: chartData[chartData.length - 1].time, value: 0 },
    ] as any);

    // ── Sync timescales ───────────────────────────────────────────────────
    ca.timeScale().fitContent();
    cb.timeScale().fitContent();

    let syncing = false;
    ca.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || syncing) return;
      syncing = true;
      cb.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    });
    cb.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range || syncing) return;
      syncing = true;
      ca.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    });

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      if (priceRef.current) ca.applyOptions({ width: priceRef.current.clientWidth });
      if (obvRef.current)   cb.applyOptions({ width: obvRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ca.remove();
      cb.remove();
    };
  }, [chartData, events, cycles]);

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-0">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 mb-2">
        <span className="text-[10px] text-slate-500">●</span>
        <span className="text-[10px]" style={{ color: "#e879f9" }}>● Sinyal Leading Pre-Markup</span>
        <span className="text-[10px]" style={{ color: "#fbbf24" }}>■ Volume Surge / Markup</span>
        <span className="text-[10px]" style={{ color: "#f87171" }}>■ Distribusi</span>
        <span className="text-[10px]" style={{ color: "#34d399" }}>■ Support Bounce</span>
        <span className="text-[10px] text-slate-600">— Cycle phase line</span>
      </div>

      {/* MA Legend */}
      <div className="flex gap-4 px-1 mb-2">
        <span className="text-[10px] flex items-center gap-1" style={{ color: "#3b82f6" }}>
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: "#3b82f6" }} /> MA20
        </span>
        <span className="text-[10px] flex items-center gap-1" style={{ color: "#a855f7" }}>
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: "#a855f7" }} /> MA50
        </span>
      </div>

      {/* Price + Volume chart */}
      <div
        ref={priceRef}
        className="w-full rounded-t-2xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.15)" }}
      />

      {/* OBV chart */}
      <div className="w-full px-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "#e879f9", background: "rgba(168,85,247,0.06)", paddingTop: "4px" }}>
        OBV (On-Balance Volume)
      </div>
      <div
        ref={obvRef}
        className="w-full rounded-b-2xl overflow-hidden"
        style={{ background: "rgba(168,85,247,0.04)", borderTop: "1px solid rgba(168,85,247,0.12)" }}
      />
    </div>
  );
}
