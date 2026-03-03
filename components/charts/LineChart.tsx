"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, AreaSeries } from "lightweight-charts";

interface LineChartProps {
  data: { time: string | number; value: number }[];
  height?: number;
  lineColor?: string;
  areaTopColor?: string;
  areaBottomColor?: string;
  title?: string;
}

export default function LineChart({
  data,
  height = 400,
  lineColor = "#f97316",
  areaTopColor = "rgba(249, 115, 22, 0.3)",
  areaBottomColor = "rgba(249, 115, 22, 0.0)",
  title,
}: LineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const isIntraday = typeof data[0]?.time === "number";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "Arial, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(226, 232, 240, 0.05)" },
        horzLines: { color: "rgba(226, 232, 240, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        vertLine: { color: "rgba(249, 115, 22, 0.3)", labelBackgroundColor: "#064e3b" },
        horzLine: { color: "rgba(249, 115, 22, 0.3)", labelBackgroundColor: "#064e3b" },
      },
      rightPriceScale: { borderColor: "rgba(226, 232, 240, 0.1)" },
      timeScale: {
        borderColor: "rgba(226, 232, 240, 0.1)",
        timeVisible: isIntraday,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
      crosshairMarkerBackgroundColor: lineColor,
      crosshairMarkerBorderColor: "#fff",
    });

    series.setData(data as any);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, height, lineColor, areaTopColor, areaBottomColor]);

  return (
    <div>
      {title && <h3 className="text-sm font-medium text-silver-400 mb-2">{title}</h3>}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
