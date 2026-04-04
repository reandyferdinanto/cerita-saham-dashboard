"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineSeries,
} from "lightweight-charts";
import { OHLCData } from "@/lib/types";

type FlowPoint = {
  time: string;
  value: number;
};

export default function StockSummaryAccumulationChart({
  priceData,
  localFlow,
  foreignFlow,
  height = 420,
}: {
  priceData: OHLCData[];
  localFlow: FlowPoint[];
  foreignFlow: FlowPoint[];
  height?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || priceData.length === 0) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(226,232,240,0.04)" },
        horzLines: { color: "rgba(226,232,240,0.04)" },
      },
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(226,232,240,0.08)",
      },
      leftPriceScale: {
        visible: true,
        borderColor: "rgba(226,232,240,0.08)",
      },
      timeScale: {
        borderColor: "rgba(226,232,240,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(249,115,22,0.28)" },
        horzLine: { color: "rgba(249,115,22,0.28)" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      priceScaleId: "right",
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    candleSeries.setData(
      priceData.map((item) => ({
        time: typeof item.time === "string" ? item.time : new Date(item.time * 1000).toISOString().slice(0, 10),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      })) as never
    );

    const localSeries = chart.addSeries(LineSeries, {
      priceScaleId: "left",
      color: "#f97316",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    });
    localSeries.setData(localFlow as never);

    const foreignSeries = chart.addSeries(LineSeries, {
      priceScaleId: "left",
      color: "#3b82f6",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    });
    foreignSeries.setData(foreignFlow as never);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [priceData, localFlow, foreignFlow, height]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-2 text-silver-300">
          <span className="w-4 h-0.5 rounded" style={{ background: "#f97316" }} />
          Akumulasi Lokal
        </span>
        <span className="inline-flex items-center gap-2 text-silver-300">
          <span className="w-4 h-0.5 rounded" style={{ background: "#3b82f6" }} />
          Akumulasi Foreign
        </span>
        <span className="inline-flex items-center gap-2 text-silver-300">
          <span className="w-4 h-2 rounded-sm" style={{ background: "linear-gradient(180deg, #10b981 0%, #ef4444 100%)" }} />
          Candlestick Harga
        </span>
      </div>
      <div ref={chartRef} className="w-full" />
    </div>
  );
}
