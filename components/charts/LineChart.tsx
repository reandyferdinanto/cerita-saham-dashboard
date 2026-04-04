"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  AreaSeries,
  AreaData,
  TickMarkType,
  Time,
} from "lightweight-charts";

type LineChartPoint = {
  time: string | number;
  value: number;
};

interface LineChartProps {
  data: LineChartPoint[];
  height?: number;
  lineColor?: string;
  areaTopColor?: string;
  areaBottomColor?: string;
  locale?: string;
  timeZone?: string;
  title?: string;
}

function toDateFromChartTime(time: Time): Date | null {
  if (typeof time === "number") {
    return new Date(time * 1000);
  }

  if (typeof time === "string") {
    return new Date(`${time}T00:00:00Z`);
  }

  if ("timestamp" in time) {
    return new Date(time.timestamp * 1000);
  }

  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

export default function LineChart({
  data,
  height = 400,
  lineColor = "#f97316",
  areaTopColor = "rgba(249, 115, 22, 0.3)",
  areaBottomColor = "rgba(249, 115, 22, 0.0)",
  locale = "id-ID",
  timeZone,
  title,
}: LineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chartData: AreaData<Time>[] = data.map((point) => ({
      time: point.time as Time,
      value: point.value,
    }));

    const isIntraday = typeof data[0]?.time === "number";
    const dateTimeOptions = timeZone ? { timeZone } : undefined;
    const intradayFormatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...dateTimeOptions,
    });
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      ...dateTimeOptions,
    });
    const monthFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "2-digit",
      ...dateTimeOptions,
    });

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
      localization: {
        locale,
        timeFormatter: (time: Time) => {
          const date = toDateFromChartTime(time);
          if (!date) return "";
          return isIntraday
            ? intradayFormatter.format(date)
            : dateFormatter.format(date);
        },
      },
      rightPriceScale: { borderColor: "rgba(226, 232, 240, 0.1)" },
      timeScale: {
        borderColor: "rgba(226, 232, 240, 0.1)",
        timeVisible: isIntraday,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          const date = toDateFromChartTime(time);
          if (!date) return "";
          if (isIntraday) return intradayFormatter.format(date);
          if (tickMarkType === TickMarkType.Month || tickMarkType === TickMarkType.Year) {
            return monthFormatter.format(date);
          }
          return dateFormatter.format(date);
        },
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

    series.setData(chartData);
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
  }, [areaBottomColor, areaTopColor, data, height, lineColor, locale, timeZone]);

  return (
    <div>
      {title && <h3 className="text-sm font-medium text-silver-400 mb-2">{title}</h3>}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
