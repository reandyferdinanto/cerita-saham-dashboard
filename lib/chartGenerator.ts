import { OHLCVBar, calcMACDSeries } from "./technicalSignals";

export async function generateStockChartImageUrl(ticker: string, history: OHLCVBar[], interval: string = "1D") {
  // 1. Hitung MACD pada SELURUH history
  const fullCloses = history.map(b => b.close);
  const fullMacd = calcMACDSeries(fullCloses);

  // 2. Tentukan jumlah bar yang akan ditampilkan
  const displayCount = Math.min(history.length, 66);
  const bars = history.slice(-displayCount);
  const displayIdxStart = history.length - bars.length;
  
  const macdSlice = fullMacd.macd.slice(displayIdxStart);
  const signalSlice = fullMacd.signal.slice(displayIdxStart);
  const histSlice = fullMacd.hist.slice(displayIdxStart);

  // 3. Konversi waktu ke milidetik agar terbaca Chart.js time axis
  const timeLabels = bars.map(b => {
    const t = typeof b.time === "number" ? b.time * 1000 : b.time;
    return new Date(t).getTime();
  });

  const intervalLabel = interval.toUpperCase();

  const chartConfig = {
    type: "candlestick",
    data: {
      datasets: [
        {
          label: "Price",
          data: bars.map((b, i) => ({
            x: timeLabels[i],
            o: b.open,
            h: b.high,
            l: b.low,
            c: b.close
          })),
          yAxisID: "y"
        },
        {
          type: "bar",
          label: "Volume",
          data: bars.map((b, i) => ({ 
            x: timeLabels[i], 
            y: b.volume 
          })),
          yAxisID: "yVolume",
          backgroundColor: bars.map(b => b.close >= b.open ? "rgba(38, 166, 154, 0.4)" : "rgba(239, 83, 80, 0.4)")
        },
        {
          type: "line",
          label: "MACD",
          data: macdSlice.map((v, i) => ({ 
            x: timeLabels[i], 
            y: v !== null ? Number(v.toFixed(2)) : null 
          })),
          yAxisID: "yMACD",
          borderColor: "#2962FF",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        },
        {
          type: "line",
          label: "Signal",
          data: signalSlice.map((v, i) => ({ 
            x: timeLabels[i], 
            y: v !== null ? Number(v.toFixed(2)) : null 
          })),
          yAxisID: "yMACD",
          borderColor: "#FF6D00",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        },
        {
          type: "bar",
          label: "Hist",
          data: histSlice.map((v, i) => ({ 
            x: timeLabels[i], 
            y: v !== null ? Number(v.toFixed(2)) : null 
          })),
          backgroundColor: histSlice.map(v => (v || 0) >= 0 ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)"),
          yAxisID: "yMACD"
        }
      ]
    },
    options: {
      layout: {
        padding: { top: 60, right: 30, bottom: 10, left: 10 }
      },
      scales: {
        x: {
          type: "timeseries",
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "rgba(255, 255, 255, 0.7)", font: { size: 10 } }
        },
        y: {
          position: "right",
          stack: "main",
          stackWeight: 6,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "rgba(255, 255, 255, 0.7)", font: { size: 10 } }
        },
        yVolume: {
          display: false,
          position: "right",
          stack: "main",
          stackWeight: 1.5
        },
        yMACD: {
          position: "right",
          stack: "main",
          stackWeight: 2.5,
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "rgba(255, 255, 255, 0.5)", font: { size: 8 } }
        }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            brand: {
              type: 'label',
              xValue: timeLabels[Math.floor(timeLabels.length / 2)],
              yValue: bars[Math.floor(bars.length / 2)].close,
              content: 'ANOMALISAHAM',
              color: 'rgba(255, 255, 255, 0.05)',
              font: { size: 50, weight: 'bold' },
              backgroundColor: 'transparent'
            },
            stamp: {
              type: 'label',
              xAdjust: -280,
              yAdjust: -240,
              content: `${ticker} | ${intervalLabel}`,
              color: 'rgba(255, 255, 255, 0.25)',
              font: { size: 28, weight: 'bold' },
              backgroundColor: 'transparent'
            }
          }
        }
      }
    }
  };

  const baseUrl = "https://quickchart.io/chart";
  const params = new URLSearchParams({
    v: "3",
    width: "800",
    height: "600",
    bkg: "#061a12",
    c: JSON.stringify(chartConfig)
  });

  return `${baseUrl}?${params.toString()}`;
}
