"use client";

import { useEffect, useRef } from "react";
import { BaselineSeries, ColorType, createChart, type BaselineData, type IChartApi, type Time } from "lightweight-charts";

type FlowData = { date: string; netForeign: number; netDomestic: number };
type Props = { data: FlowData[]; height?: number };

export default function AccDistFluxChart({ data, height = 160 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#94a3b8", fontSize: 10 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: false },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // Foreign net flow — baseline at 0
    const foreignSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: "#10b981",
      topFillColor1: "rgba(16,185,129,0.4)",
      topFillColor2: "rgba(16,185,129,0.05)",
      bottomLineColor: "#ef4444",
      bottomFillColor1: "rgba(239,68,68,0.05)",
      bottomFillColor2: "rgba(239,68,68,0.4)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "Foreign",
    });

    const foreignData: BaselineData<Time>[] = data.map((d) => ({
      time: d.date as Time,
      value: d.netForeign,
    }));
    foreignSeries.setData(foreignData);

    // Domestic net flow — baseline at 0, thinner/more transparent
    const domesticSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: "#06b6d4",
      topFillColor1: "rgba(6,182,212,0.2)",
      topFillColor2: "rgba(6,182,212,0.02)",
      bottomLineColor: "#f97316",
      bottomFillColor1: "rgba(249,115,22,0.02)",
      bottomFillColor2: "rgba(249,115,22,0.2)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "Domestic",
      priceScaleId: "domestic",
    });
    chart.priceScale("domestic").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });

    const domesticData: BaselineData<Time>[] = data.map((d) => ({
      time: d.date as Time,
      value: d.netDomestic,
    }));
    domesticSeries.setData(domesticData);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height]);

  return <div ref={containerRef} />;
}
