"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  IChartApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  BaselineSeries,
} from "lightweight-charts";
import { OHLCData } from "@/lib/types";

interface CandlestickChartProps {
  data: OHLCData[];
  tp?: number | null;
  sl?: number | null;
  height?: number;
  mobileHeight?: number;
}

// ── Indicator helpers ──────────────────────────────────────────────────────────

function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) =>
    i < period - 1 ? null : closes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period
  );
}

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  closes.forEach((c, i) => {
    if (i === 0) { ema.push(c); return; }
    ema.push(c * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

interface MACDResult { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[]; }

function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9): MACDResult {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine = closes.map((_, i) => (i < slow - 1 ? null : emaFast[i] - emaSlow[i]));
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalEMA = calcEMA(macdValues, sig);
  let validSig = 0;
  const signalFinal: (number | null)[] = macdLine.map((v) => {
    if (v === null) return null;
    const s = validSig < sig - 1 ? null : signalEMA[validSig];
    validSig++;
    return s;
  });
  const histogram: (number | null)[] = macdLine.map((m, i) => m != null && signalFinal[i] != null ? m - signalFinal[i]! : null);
  return { macd: macdLine, signal: signalFinal, histogram };
}

// ── S/R helpers ────────────────────────────────────────────────────────────────

function calcATR(data: OHLCData[], period = 14): number[] {
  const tr = data.map((d, i) => {
    if (i === 0) return d.high - d.low;
    const prev = data[i - 1].close;
    return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
  });
  const atr: number[] = [];
  tr.forEach((v, i) => {
    if (i < period - 1) { atr.push(0); return; }
    if (i === period - 1) { atr.push(tr.slice(0, period).reduce((s, x) => s + x, 0) / period); }
    else { atr.push((atr[i - 1] * (period - 1) + v) / period); }
  });
  return atr;
}

interface SRLevel { price: number; idx: number; }

function calcSRZones(data: OHLCData[], pivotLeft = 7, pivotRight = 7, atrLen = 14, zoneMult = 0.25, maxStore = 60): { res: SRLevel[]; sup: SRLevel[] } {
  const atr = calcATR(data, atrLen);
  const phVals: number[] = [], phIdxs: number[] = [], plVals: number[] = [], plIdxs: number[] = [];
  for (let i = pivotLeft; i < data.length - pivotRight; i++) {
    let isPH = true;
    for (let k = i - pivotLeft; k <= i + pivotRight; k++) { if (k !== i && data[k].high >= data[i].high) { isPH = false; break; } }
    if (isPH) { phVals.unshift(data[i].high); phIdxs.unshift(i); if (phVals.length > maxStore) { phVals.pop(); phIdxs.pop(); } }
    let isPL = true;
    for (let k = i - pivotLeft; k <= i + pivotRight; k++) { if (k !== i && data[k].low <= data[i].low) { isPL = false; break; } }
    if (isPL) { plVals.unshift(data[i].low); plIdxs.unshift(i); if (plVals.length > maxStore) { plVals.pop(); plIdxs.pop(); } }
  }
  const curPrice = data[data.length - 1].close;
  const half = atr[atr.length - 1] * zoneMult;
  const res = phVals.map((v, i) => ({ price: v, idx: phIdxs[i] })).filter((z) => z.price > curPrice + half).sort((a, b) => a.price - b.price).slice(0, 2);
  const sup = plVals.map((v, i) => ({ price: v, idx: plIdxs[i] })).filter((z) => z.price < curPrice - half).sort((a, b) => b.price - a.price).slice(0, 2);
  return { res, sup };
}

// ── Component ──────────────────────────────────────────────────────────────────

type IndicatorKey = "ma5" | "ma20" | "ma50" | "ma200" | "macd" | "sr";

const INDICATOR_CONFIG: { key: IndicatorKey; label: string; color: string }[] = [
  { key: "ma5",   label: "MA5",   color: "#f59e0b" },
  { key: "ma20",  label: "MA20",  color: "#3b82f6" },
  { key: "ma50",  label: "MA50",  color: "#a855f7" },
  { key: "ma200", label: "MA200", color: "#ec4899" },
  { key: "macd",  label: "MACD",  color: "#10b981" },
  { key: "sr",    label: "S/R",   color: "#94a3b8" },
];

export default function CandlestickChart({ data, tp, sl, height = 500, mobileHeight = 320 }: CandlestickChartProps) {
  const mainRef  = useRef<HTMLDivElement>(null);
  const macdRef  = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const macdChart = useRef<IChartApi | null>(null);

  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(
    new Set(["ma5", "ma20", "ma50", "macd", "sr"])
  );

  const toggleIndicator = (key: IndicatorKey) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const showMACD = activeIndicators.has("macd");

  useEffect(() => {
    if (!mainRef.current || data.length === 0) return;

    const isMobile = window.innerWidth < 768;
    const effectiveHeight = isMobile ? mobileHeight : height;
    const isIntraday = typeof data[0]?.time === "number";
    const closes = data.map((d) => d.close);

    const sharedOpts = (h: number) => ({
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", fontFamily: "Arial, sans-serif" },
      grid: { vertLines: { color: "rgba(226,232,240,0.04)" }, horzLines: { color: "rgba(226,232,240,0.04)" } },
      crosshair: { vertLine: { color: "rgba(249,115,22,0.3)", labelBackgroundColor: "#064e3b" }, horzLine: { color: "rgba(249,115,22,0.3)", labelBackgroundColor: "#064e3b" } },
      rightPriceScale: { borderColor: "rgba(226,232,240,0.08)" },
      timeScale: { borderColor: "rgba(226,232,240,0.08)", timeVisible: isIntraday, secondsVisible: false },
      width: mainRef.current!.clientWidth,
      height: h,
    });

    const chart = createChart(mainRef.current, sharedOpts(showMACD ? Math.round(effectiveHeight * 0.68) : effectiveHeight));
    mainChart.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444",
      borderUpColor: "#10b981", borderDownColor: "#ef4444",
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    });
    candleSeries.setData(data.map((d) => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })) as any);

    const volSeries = chart.addSeries(HistogramSeries, { color: "rgba(249,115,22,0.18)", priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volSeries.setData(data.map((d) => ({ time: d.time, value: d.volume, color: d.close >= d.open ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)" })) as any);

    const maPeriods: { key: IndicatorKey; period: number; color: string }[] = [
      { key: "ma5",   period: 5,   color: "#f59e0b" },
      { key: "ma20",  period: 20,  color: "#3b82f6" },
      { key: "ma50",  period: 50,  color: "#a855f7" },
      { key: "ma200", period: 200, color: "#ec4899" },
    ];
    maPeriods.forEach(({ key, period, color }) => {
      if (!activeIndicators.has(key)) return;
      const values = calcMA(closes, period);
      const maData = data.map((d, i) => values[i] != null ? { time: d.time, value: values[i]! } : null).filter(Boolean);
      if (maData.length === 0) return;
      chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false }).setData(maData as any);
    });

    if (tp) candleSeries.createPriceLine({ price: tp, color: "#10b981", lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "TP" });
    if (sl) candleSeries.createPriceLine({ price: sl, color: "#ef4444", lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "SL" });

    if (activeIndicators.has("sr") && data.length > 20) {
      const { res, sup } = calcSRZones(data);
      const atr14 = calcATR(data, 14);
      const srHalf = atr14[atr14.length - 1] * 0.25;

      const drawZoneBand = (startIdx: number, centerPrice: number, half: number, fillColor: string, lineColor: string, label: string) => {
        const top = centerPrice + half;
        const bot = centerPrice - half;
        const slice = data.slice(startIdx);
        if (slice.length < 1) return;
        chart.addSeries(LineSeries, { color: lineColor, lineWidth: 1, lineStyle: LineStyle.Solid, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(slice.map((d) => ({ time: d.time, value: top })) as any);
        chart.addSeries(LineSeries, { color: lineColor, lineWidth: 1, lineStyle: LineStyle.Solid, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(slice.map((d) => ({ time: d.time, value: bot })) as any);
        chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: bot },
          topFillColor1: fillColor, topFillColor2: fillColor, topLineColor: "rgba(0,0,0,0)",
          bottomFillColor1: "rgba(0,0,0,0)", bottomFillColor2: "rgba(0,0,0,0)", bottomLineColor: "rgba(0,0,0,0)",
          lineWidth: 0 as any, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        }).setData(slice.map((d) => ({ time: d.time, value: top })) as any);
        candleSeries.createPriceLine({ price: centerPrice, color: "rgba(0,0,0,0)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: label });
      };

      res.forEach((level, i) => drawZoneBand(level.idx, level.price, srHalf, "rgba(239,68,68,0.10)", "rgba(239,68,68,0.45)", i === 0 ? "R1" : "R2"));
      sup.forEach((level, i) => drawZoneBand(level.idx, level.price, srHalf, "rgba(16,185,129,0.10)", "rgba(16,185,129,0.45)", i === 0 ? "S1" : "S2"));
    }

    chart.timeScale().fitContent();

    let macdChartInst: IChartApi | null = null;
    if (showMACD && macdRef.current) {
      macdChartInst = createChart(macdRef.current, { ...sharedOpts(Math.round(effectiveHeight * 0.28)), timeScale: { borderColor: "rgba(226,232,240,0.08)", timeVisible: isIntraday, secondsVisible: false, visible: true } });
      macdChart.current = macdChartInst;

      const { macd, signal, histogram } = calcMACD(closes);
      const histSeries = macdChartInst.addSeries(HistogramSeries, { priceScaleId: "right", priceLineVisible: false, lastValueVisible: false });
      histSeries.setData(data.map((d, i) => histogram[i] != null ? { time: d.time, value: histogram[i]!, color: histogram[i]! >= 0 ? "rgba(16,185,129,0.6)" : "rgba(239,68,68,0.6)" } : null).filter(Boolean) as any);
      macdChartInst.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(data.map((d, i) => macd[i] != null ? { time: d.time, value: macd[i]! } : null).filter(Boolean) as any);
      macdChartInst.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(data.map((d, i) => signal[i] != null ? { time: d.time, value: signal[i]! } : null).filter(Boolean) as any);
      macdChartInst.timeScale().fitContent();

      chart.subscribeCrosshairMove((param) => { if (param.time) macdChartInst!.setCrosshairPosition(0, param.time as any, histSeries as any); else macdChartInst!.clearCrosshairPosition(); });
      macdChartInst.subscribeCrosshairMove((param) => { if (param.time) chart.setCrosshairPosition(0, param.time as any, candleSeries as any); else chart.clearCrosshairPosition(); });
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => { if (range) macdChartInst!.timeScale().setVisibleLogicalRange(range); });
      macdChartInst.timeScale().subscribeVisibleLogicalRangeChange((range) => { if (range) chart.timeScale().setVisibleLogicalRange(range); });
    }

    const handleResize = () => {
      if (mainRef.current) {
        const w = mainRef.current.clientWidth;
        chart.applyOptions({ width: w });
        macdChartInst?.applyOptions({ width: w });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      macdChartInst?.remove();
    };
  }, [data, tp, sl, height, mobileHeight, activeIndicators, showMACD]);

  return (
    <div className="w-full">
      {/* Indicator toggles — scrollable on mobile */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-[10px] uppercase tracking-wider font-medium flex-shrink-0" style={{ color: "#334155" }}>Indikator:</span>
        {INDICATOR_CONFIG.map(({ key, label, color }) => {
          const active = activeIndicators.has(key);
          return (
            <button key={key} onClick={() => toggleIndicator(key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
              style={{ background: active ? `${color}18` : "rgba(6,78,59,0.2)", color: active ? color : "#475569", border: `1px solid ${active ? `${color}40` : "rgba(226,232,240,0.06)"}` }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? color : "#334155" }} />
              {label}
            </button>
          );
        })}
      </div>

      <div ref={mainRef} className="w-full" />

      {showMACD && (
        <div className="w-full mt-1">
          <div className="flex items-center gap-3 px-1 mb-1 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: "#334155" }}>MACD (12,26,9)</span>
            <span className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: "#3b82f6" }}><span className="w-5 h-0.5 inline-block rounded" style={{ background: "#3b82f6" }} /> MACD</span>
            <span className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: "#f97316" }}><span className="w-5 h-0.5 inline-block rounded" style={{ background: "#f97316" }} /> Signal</span>
            <span className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: "#10b981" }}><span className="w-4 h-3 inline-block rounded-sm" style={{ background: "rgba(16,185,129,0.5)" }} /> Histogram</span>
          </div>
          <div ref={macdRef} className="w-full" />
        </div>
      )}
    </div>
  );
}
