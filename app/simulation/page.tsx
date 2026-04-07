"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { createChart, IChartApi, ISeriesApi, Time, IPriceLine, AreaSeries, createSeriesMarkers, ISeriesMarkersPluginApi, SeriesMarker } from "lightweight-charts";

// Icons
const IconHome = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
const IconRefresh = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconTrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const IconTrendingDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);
const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const IconLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v4H8l4 4 4-4h-3V7z" />
  </svg>
);

const InitialCapital = 10000000; // 10 Juta Rupiah
const StartingPrice = 1000; // Harga Pertama Aset
const SHARES_PER_LOT = 100;

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
};

export default function TradingSimulator() {
  const [activeTab, setActiveTab] = useState<"avg-down" | "avg-up" | "money-management">("money-management");

  const [currentPrice, setCurrentPrice] = useState(StartingPrice);
  const [capital, setCapital] = useState(InitialCapital);
  const [totalShares, setTotalShares] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [orderLot, setOrderLot] = useState(10); // Default input lot

  const avgPrice = totalShares > 0 ? totalInvested / totalShares : 0;
  const equityValue = totalShares * currentPrice;
  const profitLoss = equityValue - totalInvested;
  const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
  
  const dailyChange = currentPrice - StartingPrice;
  const dailyChangePercent = (dailyChange / StartingPrice) * 100;
  const isPositive = dailyChange >= 0;
  const themeColor = isPositive ? "#10b981" : "#ef4444"; // Emerald or Red

  // Chart References
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const avgLineRef = useRef<IPriceLine | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const allMarkersRef = useRef<SeriesMarker<Time>[]>([]);

  // Engine State
  const priceEngineRef = useRef(StartingPrice);
  const timeEngineRef = useRef<number>(Math.floor(Date.now() / 1000));
  const isSimulationPaused = useRef(false);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: "solid" as any, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(226,232,240,0.05)", style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "rgba(226,232,240,0.1)",
        fixLeftEdge: true,
      },
      rightPriceScale: {
        borderColor: "rgba(226,232,240,0.1)",
      },
      crosshair: {
        vertLine: { color: "rgba(226,232,240,0.4)", labelBackgroundColor: "#1e293b", style: 2 },
        horzLine: { color: "rgba(226,232,240,0.4)", labelBackgroundColor: "#1e293b", style: 2 },
      },
    });

    seriesRef.current = chartRef.current.addSeries(AreaSeries, {
      lineColor: themeColor,
      topColor: isPositive ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
      bottomColor: "rgba(0, 0, 0, 0.0)",
      lineWidth: 2,
    });

    // Initialize Markers Plugin
    markersPluginRef.current = createSeriesMarkers(seriesRef.current, []);

    // Populate initial dummy history
    const history = [];
    let t = timeEngineRef.current - 100;
    let p = priceEngineRef.current;
    for (let i = 0; i < 100; i++) {
       history.push({ time: t as Time, value: p });
       p = p * (1 + (Math.random() - 0.5) * 0.02);
       t += 5; // 5 seconds interval
    }
    priceEngineRef.current = Math.floor(history[history.length - 1].value);
    timeEngineRef.current = history[history.length - 1].time as number;
    seriesRef.current.setData(history);
    setCurrentPrice(Math.floor(priceEngineRef.current));

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartRef.current?.remove();
    };
  }, []); // Only once, we'll update colors dynamically below

  // Live simulation tick engine
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSimulationPaused.current || !seriesRef.current) return;

      const volatility = 0.005; // 0.5% max jump per tick
      const dirChange = (Math.random() - 0.5) * 2; // -1 to 1
      
      const newPrice = Math.max(10, priceEngineRef.current * (1 + dirChange * volatility));
      priceEngineRef.current = newPrice;
      timeEngineRef.current += 5; // advance 5 seconds

      seriesRef.current.update({
        time: timeEngineRef.current as Time,
        value: newPrice,
      });

      setCurrentPrice(Math.floor(newPrice));
    }, 1000); // UI Tick every 1 second

    return () => clearInterval(interval);
  }, []);

  // Update Chart Theme Color when price drops below starting point
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.applyOptions({
        lineColor: themeColor,
        topColor: isPositive ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
      });
    }
  }, [themeColor, isPositive]);

  // Update Average Price Line on Chart
  useEffect(() => {
    if (!seriesRef.current) return;
    if (avgPrice > 0) {
       if (!avgLineRef.current) {
          avgLineRef.current = seriesRef.current.createPriceLine({
             price: avgPrice,
             color: "#3b82f6", // Blue for average price
             lineWidth: 2,
             lineStyle: 1, // Dotted
             axisLabelVisible: true,
             title: "AVG Modal",
          });
       } else {
          avgLineRef.current.applyOptions({ price: avgPrice });
       }
    } else {
       if (avgLineRef.current) {
          seriesRef.current.removePriceLine(avgLineRef.current);
          avgLineRef.current = null;
       }
    }
  }, [avgPrice]);

  const resetSim = () => {
    priceEngineRef.current = StartingPrice;
    setCurrentPrice(StartingPrice);
    setCapital(InitialCapital);
    setTotalShares(0);
    setTotalInvested(0);
    setOrderLot(10);
    
    // reset chart data
    if (seriesRef.current) {
       timeEngineRef.current = Math.floor(Date.now() / 1000);
       seriesRef.current.setData([{ time: timeEngineRef.current as Time, value: StartingPrice }]);
       allMarkersRef.current = [];
       markersPluginRef.current?.setMarkers([]);
    }
  };

  const buyStock = (lot: number) => {
    if (lot <= 0) return;
    
    const currentLive = priceEngineRef.current;
    const sharesToBuy = lot * SHARES_PER_LOT;
    const actualCost = sharesToBuy * currentLive;

    if (actualCost > capital) {
        alert("Balance tidak cukup!");
        return;
    }

    setCapital((prev) => prev - actualCost);
    setTotalInvested((prev) => prev + actualCost);
    setTotalShares((prev) => prev + sharesToBuy);

    // Mark buy on chart
    if (markersPluginRef.current) {
       const newMarker: SeriesMarker<Time> = {
          time: timeEngineRef.current as Time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `Buy ${lot}L`,
       };
       allMarkersRef.current = [...allMarkersRef.current, newMarker];
       markersPluginRef.current.setMarkers(allMarkersRef.current);
    }
  };

  const sellStock = () => {
    const currentLive = priceEngineRef.current;
    const finalEquity = totalShares * currentLive;
    
    setCapital((prev) => prev + finalEquity);
    setTotalInvested(0);
    setTotalShares(0);

    // Mark sell on chart
    if (markersPluginRef.current) {
       const newMarker: SeriesMarker<Time> = {
          time: timeEngineRef.current as Time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: profitLoss < 0 ? 'Cut Loss' : 'Take Profit',
       };
       allMarkersRef.current = [...allMarkersRef.current, newMarker];
       markersPluginRef.current.setMarkers(allMarkersRef.current);
    }
  };

  const simulateMarket = (direction: "up" | "down", percentage: number) => {
    const factor = direction === "up" ? 1 + percentage / 100 : 1 - percentage / 100;
    const newPrice = priceEngineRef.current * factor;
    
    priceEngineRef.current = newPrice;
    timeEngineRef.current += 5;
    
    if (seriesRef.current) {
      seriesRef.current.update({
        time: timeEngineRef.current as Time,
        value: newPrice,
      });
    }
    setCurrentPrice(Math.floor(newPrice));
  };

  const currentInvestmentCost = orderLot * SHARES_PER_LOT * currentPrice;

  return (
    <div className="space-y-8 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <Link href="/" className="text-silver-500 hover:text-orange-400 transition-colors flex items-center gap-1">
          <IconHome className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <IconChevronRight className="w-3 h-3 text-silver-600" />
        <Link href="/guidance" className="text-silver-500 hover:text-orange-400 transition-colors">
          Panduan
        </Link>
        <IconChevronRight className="w-3 h-3 text-silver-600" />
        <span className="text-silver-300">Simulasi Trading</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(30,58,138,0.5) 0%, rgba(6,20,14,0.8) 60%, rgba(120,53,15,0.3) 100%)",
          border: "1px solid rgba(59,130,246,0.15)",
        }}>
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
              Interactive Sandbox
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-silver-100 mb-3 leading-tight">
            Simulasi <span style={{ color: "#60a5fa" }}>Trading & Money Management</span>
          </h1>
          <p className="text-sm sm:text-base text-silver-400 max-w-2xl mb-5">
            Eksperimen langsung kapan harus Average Down, Average Up, dan melakukan Cut Loss. Pelajari betapa berbahayanya All-In dan mengapa strategi Piramida adalah manajemen risiko terbaik.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1 rounded-xl" style={{ background: "rgba(6,20,14,0.3)" }}>
        {["money-management", "avg-down", "avg-up"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-md"
                : "text-silver-400 hover:text-silver-300 hover:bg-white/5"
            }`}
          >
            {tab === "money-management" ? " Money Management & Piramida" : tab === "avg-down" ? "Average Down & Cut Loss" : "Average Up (Pyramiding)"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "money-management" && (
            <div className="space-y-6">
              <GlassCard hover={false} className="!p-6 relative overflow-hidden">
                <IconShield className="absolute -right-10 -bottom-10 w-48 h-48 opacity-[0.03] text-blue-500" />
                <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <IconShield className="w-5 h-5" /> Aturan Tiga Langkah (Piramida Pembelian)
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed max-w-3xl mb-6">
                  Jangan pernah memasukkan seluruh modal (ALL-IN) dalam satu pesanan. Membagi pembelian (Mencicil) dalam porsi yang semakin mengecil atau membesar tergantung situasi. Format teraman adalah: <strong className="text-emerald-400">Piramida Investasi 2-3-5</strong> atau <strong className="text-blue-400">1-3-6</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl text-center space-y-2" style={{ background: "rgba(16,185,129,0.05)", border: "1px dashed rgba(16,185,129,0.2)" }}>
                    <div className="text-xs font-bold text-emerald-400 uppercase">Entry Pertama (Test water)</div>
                    <div className="text-2xl font-bold text-silver-100">20%</div>
                    <div className="text-xs text-silver-400">Modal dialokasikan di dekat Support. Digunakan untuk melihat respons market.</div>
                  </div>
                  <div className="p-4 rounded-xl text-center space-y-2" style={{ background: "rgba(59,130,246,0.05)", border: "1px dashed rgba(59,130,246,0.2)" }}>
                    <div className="text-xs font-bold text-blue-400 uppercase">Entry Kedua (Konfirmasi)</div>
                    <div className="text-2xl font-bold text-silver-100">30%</div>
                    <div className="text-xs text-silver-400">Jika harga mantul naik, tambah muatan di area ini. Jika harga turun dan sentuh konfirmasi Support ke-2, tambah muatan.</div>
                  </div>
                  <div className="p-4 rounded-xl text-center space-y-2" style={{ background: "rgba(245,158,11,0.05)", border: "1px dashed rgba(245,158,11,0.2)" }}>
                    <div className="text-xs font-bold text-amber-400 uppercase">Entry Ketiga (All-in Power)</div>
                    <div className="text-2xl font-bold text-silver-100">50%</div>
                    <div className="text-xs text-silver-400">Masuk besar ketika sinyal tren sudah valid menembus resisten atau Breakout kuat.</div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === "avg-down" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard hover={false} className="!p-6">
                <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                  <IconTrendingDown className="w-5 h-5" /> Average Down Terukur vs Averaging Bodoh
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed mb-4">
                  <strong>Average Down</strong> adalah membeli lagi saat harga saham turun demi menurunkan <strong className="text-blue-400">Harga Rata-Rata (Average Price)</strong> Anda. 
                </p>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", borderLeft: "3px solid #ef4444" }}>
                    <p className="text-xs font-bold text-red-400 mb-1">Kapan JANGAN Average Down (Cutloss Saja!):</p>
                    <ul className="text-xs text-silver-300 space-y-1 ml-4 list-disc">
                      <li>Harga terus menembus Support berulang-ulang tanpa perlawanan.</li>
                      <li>Perusahaan terkena skandal fundamental / kebangkrutan.</li>
                      <li>Anda sudah kehabisan lebih dari 60% modal untuk saham tersebut.</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", borderLeft: "3px solid #10b981" }}>
                    <p className="text-xs font-bold text-emerald-400 mb-1">Kapan BOLEH Average Down:</p>
                    <ul className="text-xs text-silver-300 space-y-1 ml-4 list-disc">
                      <li>Harga menyentuh area <strong>Support Mayor</strong> yang sangat kuat.</li>
                      <li>Penurunan disertai dengan <strong className="text-orange-400">Volume yang sangat sepi</strong> (pertanda penjualan kecil/ritel).</li>
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === "avg-up" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard hover={false} className="!p-6">
                <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <IconTrendingUp className="w-5 h-5" /> Average Up (Pyramiding Profit)
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed mb-4">
                  Trader ritel hobi *"Averaging Down"* (menambah posisi saat rugi), tapi Trader Profesional selalu hobi <strong className="text-emerald-400">*Average Up*</strong> atau Piramida Atas (menambah posisi saat saham naik/profit).
                </p>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", borderLeft: "3px solid #10b981" }}>
                    <p className="text-xs font-bold text-emerald-400 mb-1">Strategi Pyramiding (Mencicil Naik):</p>
                    <ul className="text-xs text-silver-300 space-y-1 ml-4 list-decimal">
                      <li>Beli porsi awal (misal 30% dana) saat Breakout Support.</li>
                      <li>Jika harga naik menembus Resisten Pertama (R1) & bertahan di sana, maka R1 berubah jadi Support baru. Tambah 30-50% porsi lagi!</li>
                      <li>*Average Price* kamu otomatis naik, tapi <strong className="text-blue-400">Total Saham & Nilai Profit Rupiahmu menjadi berganda</strong>.</li>
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ─── LIVE TRADING TERMINAL STYLE ─────────────────────────────────── */}
      <GlassCard hover={false} className="!p-0 overflow-hidden relative mt-10" style={{ border: "1px solid rgba(59,130,246,0.3)" }}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-white/5" style={{ background: "rgba(15,23,42,0.6)" }}>
           <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-silver-100">
             <IconShield className="w-5 h-5 text-blue-500" /> Live Trading Terminal
           </h2>
           <button onClick={resetSim} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-white/5 text-silver-300 hover:bg-white/10 hover:text-white transition-all border border-white/10">
             <IconRefresh className="w-3.5 h-3.5" /> Ulangi Simulasi (Reset)
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 md:divide-x divide-white/5">
          {/* LEFT COLUMN: Chart & Stats */}
          <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col gap-4">
             {/* Header Stock */}
             <div className="flex justify-between items-start">
               <div>
                  <h2 className="text-2xl font-black flex items-center gap-2 tracking-wide text-silver-100">
                    CRTA <span className="border border-white/20 text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-silver-300 font-semibold tracking-normal">Virtual</span>
                  </h2>
                  <p className="text-xs text-silver-400 mt-0.5">anomalisaham Labs</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                 <IconLogo className="w-5 h-5" />
               </div>
             </div>
             
             {/* Price Big */}
             <div>
               <div className="text-4xl font-black mb-1" style={{ color: themeColor }}>
                 {currentPrice.toLocaleString("id-ID")}
               </div>
               <div className="text-sm font-bold flex items-center gap-1" style={{ color: themeColor }}>
                 {isPositive ? <IconTrendingUp className="w-4 h-4" /> : <IconTrendingDown className="w-4 h-4" />}
                 {isPositive ? '+' : ''}{(dailyChange)} ({isPositive ? '+' : ''}{dailyChangePercent.toFixed(2)}%) Hari Ini
               </div>
               <div className="flex gap-2 mt-2">
                 <span className="text-[10px] border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-sm bg-emerald-500/10">Tech & Software</span>
                 <span className="text-[10px] border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-sm bg-blue-500/10">Syariah</span>
               </div>
             </div>

             {/* Chart Container */}
             <div className="w-full h-80 rounded-xl overflow-hidden mt-2 relative" ref={chartContainerRef} style={{ background: "rgba(0,0,0,0.3)" }}>
                {/* Lightweight Chart injected here */}
             </div>

             {/* Timeframes (Visual mockup) */}
             <div className="flex justify-between items-center text-[11px] sm:text-xs font-bold text-silver-500 border-b border-white/5 pb-2 px-1">
                 <span className="text-emerald-400 border-b-2 border-emerald-400 pb-1 cursor-pointer">1D</span>
                 <span className="cursor-pointer hover:text-silver-300">1W</span>
                 <span className="cursor-pointer hover:text-silver-300">1M</span>
                 <span className="cursor-pointer hover:text-silver-300">3M</span>
                 <span className="cursor-pointer hover:text-silver-300">YTD</span>
                 <span className="cursor-pointer hover:text-silver-300">1Y</span>
                 <span className="cursor-pointer hover:text-silver-300">3Y</span>
                 <span className="cursor-pointer hover:text-silver-300">5Y</span>
                 <IconTrendingUp className="w-4 h-4 text-emerald-400" />
             </div>

             {/* Key Stats Block */}
             <div className="grid grid-cols-2 gap-4 sm:gap-6 mt-3 px-2">
                 <div className="space-y-3 relative text-[11px] sm:text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-silver-400">Open</span> <span className="text-silver-200 font-medium">1,000</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-silver-400">High</span> <span className="text-emerald-400 font-medium">{Math.floor(StartingPrice * 1.05).toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-silver-400">Low</span> <span className="text-red-400 font-medium">{Math.floor(StartingPrice * 0.95).toLocaleString("id-ID")}</span></div>
                 </div>
                 <div className="space-y-3 relative text-[11px] sm:text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-silver-400">Volume</span> <span className="text-emerald-400 font-medium">4.5M Lot</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-silver-400">Harga Modal Rata-Mu</span> 
                      <span className="text-blue-400 font-bold">{avgPrice > 0 ? `Rp ${Math.floor(avgPrice).toLocaleString("id-ID")}` : "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-silver-400">Total Lot Dimiliki</span>
                      <span className="text-silver-200 font-bold">{totalShares > 0 ? (totalShares / SHARES_PER_LOT).toLocaleString("id-ID") : 0}</span>
                    </div>
                 </div>
             </div>
          </div>

          {/* RIGHT COLUMN: Order Form */}
          <div className="lg:col-span-4 flex flex-col relative" style={{ background: "rgba(0,0,0,0.2)" }}>
              {/* Top Banner Limit */}
              <div className="py-2 px-4 border-b border-white/5 text-right">
                <span className="text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">Limit Order ⏷</span>
              </div>

              <div className="p-4 sm:p-6 flex flex-col gap-6 flex-1">
                  
                  {/* Saldo Trading */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-silver-400">Trading Balance</span>
                    <span className="font-black text-silver-100 whitespace-nowrap">{formatRupiah(capital)}</span>
                  </div>
                  
                  {/* Slider Simulation */}
                  <div className="pt-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={Math.min(100, Math.max(0, (capital > 0 ? (orderLot * SHARES_PER_LOT * currentPrice) / capital * 100 : 0)))}
                      onChange={(e) => {
                        const maxLot = Math.floor(capital / (currentPrice * SHARES_PER_LOT));
                        const pct = Number(e.target.value) / 100;
                        setOrderLot(Math.floor(maxLot * pct));
                      }}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 focus:outline-none"
                    />
                    <div className="flex justify-between items-center text-[10px] sm:text-xs text-silver-500 font-bold mt-2">
                      <span>0%</span>
                      <span className="text-blue-400">
                        {capital > 0 ? Math.floor(((orderLot * SHARES_PER_LOT * currentPrice) / capital) * 100) : 0}% 
                      </span>
                      <span>Capital</span>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-xs font-bold text-silver-400">Price</span>
                        <div className="flex items-center text-sm font-bold text-silver-200">
                          <span className="text-silver-500 mr-4 cursor-not-allowed">−</span>
                          <span className="w-20 text-right">{currentPrice.toLocaleString("id-ID")}</span>
                          <span className="text-emerald-400 ml-4 cursor-not-allowed">+</span>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <span className="text-xs font-bold text-silver-400 flex flex-col">
                           Buy Order Lot
                           <span className="text-[10px] text-silver-500 font-normal mt-0.5">(1 Lot = 100 lbr)</span>
                        </span>
                        <div className="flex flex-col items-end">
                           <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-1 w-28 shrink-0 relative">
                             <div className="absolute inset-0 bg-blue-500/10 opacity-0 transition-opacity focus-within:opacity-100 rounded-lg pointers-events-none" />
                             <button onClick={()=>setOrderLot(Math.max(1, orderLot - 1))} className="w-8 h-8 rounded text-silver-400 hover:text-white hover:bg-white/10 text-xl flex items-center justify-center relative z-10 transition-colors">−</button>
                             <input 
                                type="number" 
                                value={orderLot} 
                                onChange={(e)=> {
                                  // Jangan biarkan user input string kosong, setidaknya 0
                                  const val = parseInt(e.target.value) || 0;
                                  setOrderLot(Math.max(0, val));
                                }} 
                                className="w-full bg-transparent text-center font-black text-sm outline-none text-silver-100 placeholder-silver-600 relative z-10 appearance-none" 
                                style={{ WebkitAppearance: 'none', margin: 0 }}
                             />
                             <button onClick={()=>setOrderLot(orderLot + 1)} className="w-8 h-8 rounded text-silver-400 hover:text-white hover:bg-white/10 text-xl flex items-center justify-center relative z-10 transition-colors">+</button>
                           </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-silver-400">Expiry</span>
                        <span className="text-xs font-medium bg-black/20 px-2 py-1 border border-white/5 rounded text-silver-300">
                           Day ⏷
                        </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold text-silver-400">Total Investment</span>
                        <span className="text-sm font-black text-blue-400">{formatRupiah(currentInvestmentCost)}</span>
                    </div>
                  </div>

                  {/* Buttons Action */}
                  <div className="flex flex-col gap-3 mt-4">
                    <button 
                        disabled={capital < currentInvestmentCost || orderLot <= 0}
                        onClick={() => buyStock(orderLot)}
                        className="w-full py-3.5 sm:py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:shadow-none font-black text-sm text-white transition-all tracking-widest text-center focus:ring-4 focus:ring-emerald-500/30"
                      >
                        B E L I
                     </button>

                     {totalShares > 0 && (
                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <div className="flex justify-between text-[11px] sm:text-xs">
                           <span className="text-silver-400 font-bold uppercase tracking-wider">Floating Portofolio P/L</span>
                           <span className={`font-black ${profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {profitLoss >= 0 ? "+" : ""}{formatRupiah(profitLoss)} ({profitLossPercent.toFixed(2)}%)
                           </span>
                          </div>
                          <button 
                             onClick={() => sellStock()}
                             className="w-full py-3 rounded-lg shadow-inner shadow-white/5 bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold text-xs tracking-widest uppercase focus:ring-2 focus:ring-red-500/50"
                           >
                             Jual Semua (Sell/Cutloss)
                           </button>
                        </div>
                     )}
                  </div>
              </div>

               {/* Market Maker Cheat Panel */}
               <div className="mt-auto bg-black/40 border-t border-white/5 p-4 sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-silver-500 mb-2 flex items-center gap-1.5"><IconActivity className="w-3.5 h-3.5" /> Market Maker Simulation</p>
                  <p className="text-[10px] text-silver-400 mb-3 leading-tight">Tekan tombol ini untuk merubah kondisi pasar *(naik/turun instan)* lalu pelajari efek rata-rata harga belimu.</p>
                  <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => simulateMarket("down", 5)} className="py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all shadow shadow-red-500/10">Banting ARB (-5%)</button>
                     <button onClick={() => simulateMarket("up", 5)} className="py-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-all shadow shadow-emerald-500/10">Angkat ARA (+5%)</button>
                  </div>
               </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// Minimal temporary icon substitute if global activity icon isn't imported
const IconActivity = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
