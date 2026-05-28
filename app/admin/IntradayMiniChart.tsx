"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, type CandlestickData, type IChartApi, type Time } from "lightweight-charts";
import type { OHLCData } from "@/lib/types";

type Props = { data: OHLCData[]; height?: number };

export default function IntradayMiniChart({ data, height = 150 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", fontSize: 9 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.06)" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444", borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });

    const mapped: CandlestickData[] = data.map((d) => ({
      time: (typeof d.time === "number" ? d.time : Math.floor(new Date(d.time).getTime() / 1000)) as Time,
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));

    series.setData(mapped);

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeries.setData(
      data.map((d) => ({
        time: (typeof d.time === "number" ? d.time : Math.floor(new Date(d.time).getTime() / 1000)) as Time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
      }))
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height]);

  return <div ref={containerRef} />;
}
