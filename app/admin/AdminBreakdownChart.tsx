"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { OHLCData } from "@/lib/types";

type BreakdownChartProps = {
  data: OHLCData[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  height?: number;
};

const asChartTime = (time: string | number) => time as Time;

function calcSMA(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  let sum = 0;

  values.forEach((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) result[index] = sum / period;
  });

  return result;
}

function compactLineData(data: OHLCData[], values: Array<number | null>): LineData<Time>[] {
  return data.flatMap((item, index) => {
    const value = values[index];
    return value == null ? [] : [{ time: asChartTime(item.time), value }];
  });
}

function normalizeTime(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "year" in value && "month" in value && "day" in value) {
    const item = value as { year: number; month: number; day: number };
    return `${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
  }
  return "";
}

export default function AdminBreakdownChart({ data, selectedIndex, onSelect, height = 430 }: BreakdownChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "var(--font-geist-sans)",
      },
      grid: {
        vertLines: { color: "rgba(226,232,240,0.04)" },
        horzLines: { color: "rgba(226,232,240,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(251,146,60,0.28)", labelBackgroundColor: "#0f1f18" },
        horzLine: { color: "rgba(251,146,60,0.28)", labelBackgroundColor: "#0f1f18" },
      },
      rightPriceScale: { borderColor: "rgba(226,232,240,0.08)" },
      timeScale: {
        borderColor: "rgba(226,232,240,0.08)",
        timeVisible: false,
        secondsVisible: false,
      },
      width: chartRef.current.clientWidth,
      height,
    });
    chartInst.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    candleSeries.setData(
      data.map((item) => ({
        time: asChartTime(item.time),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      })) as CandlestickData<Time>[]
    );

    if (selectedIndex != null && data[selectedIndex]) {
      const selected = data[selectedIndex];
      const marker: SeriesMarker<Time> = {
        time: asChartTime(selected.time),
        position: "aboveBar",
        color: "#fb923c",
        shape: "circle",
        text: "Klik",
      };
      createSeriesMarkers(candleSeries, [marker]);
    }

    const closes = data.map((item) => item.close);
    [
      { period: 5, label: "MA5", color: "#fbbf24" },
      { period: 10, label: "MA10", color: "#60a5fa" },
      { period: 20, label: "MA20", color: "#fb923c" },
      { period: 60, label: "MA60", color: "#c084fc" },
    ].forEach((ma) => {
      const values = calcSMA(closes, ma.period);
      const lineData = compactLineData(data, values);
      if (lineData.length === 0) return;
      chart.addSeries(LineSeries, {
        color: ma.color,
        lineWidth: ma.period === 60 ? 2 : 1,
        priceLineVisible: false,
        lastValueVisible: true,
        title: ma.label,
        crosshairMarkerVisible: false,
      }).setData(lineData);
    });

    const timeToIndex = new Map(data.map((item, index) => [String(item.time), index]));
    const handleClick = (param: { time?: unknown }) => {
      const timeKey = normalizeTime(param.time);
      const index = timeToIndex.get(timeKey);
      if (index != null) onSelect(index);
    };

    chart.subscribeClick(handleClick);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 110), to: data.length + 8 });

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.unsubscribeClick(handleClick);
      chart.remove();
    };
  }, [data, height, onSelect, selectedIndex]);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-3 px-1 text-[10px] font-bold uppercase tracking-[0.16em]">
        <span className="text-silver-500">Price</span>
        <span className="text-[#fbbf24]">MA5</span>
        <span className="text-[#60a5fa]">MA10</span>
        <span className="text-[#fb923c]">MA20</span>
        <span className="text-[#c084fc]">MA60</span>
      </div>
      <div ref={chartRef} className="w-full" />
    </div>
  );
}
