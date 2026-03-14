"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { createChart, IChartApi, ISeriesApi, Time, IPriceLine, AreaSeries } from "lightweight-charts";

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

const InitialCapital = 10000000; // 10 Juta Rupiah
const StartingPrice = 1000; // Harga Pertama Aset

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
};

export default function TradingSimulator() {
  const [activeTab, setActiveTab] = useState<"avg-down" | "avg-up" | "money-management">("money-management");

  const [currentPrice, setCurrentPrice] = useState(StartingPrice);
  const [capital, setCapital] = useState(InitialCapital);
  const [totalShares, setTotalShares] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [trades, setTrades] = useState<{ price: number; shares: number; type: "buy" | "sell" }[]>([]);

  const avgPrice = totalShares > 0 ? totalInvested / totalShares : 0;
  const equityValue = totalShares * currentPrice;
  const profitLoss = equityValue - totalInvested;
  const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  // Chart References
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const avgLineRef = useRef<IPriceLine | null>(null);

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
        vertLines: { color: "rgba(226,232,240,0.05)" },
        horzLines: { color: "rgba(226,232,240,0.05)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "rgba(226,232,240,0.1)",
      },
      rightPriceScale: {
        borderColor: "rgba(226,232,240,0.1)",
      },
      crosshair: {
        vertLine: { color: "rgba(226,232,240,0.4)", labelBackgroundColor: "#1e293b" },
        horzLine: { color: "rgba(226,232,240,0.4)", labelBackgroundColor: "#1e293b" },
      },
    });

    seriesRef.current = chartRef.current.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.4)",
      bottomColor: "rgba(59, 130, 246, 0.0)",
      lineWidth: 2,
    });

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
  }, []);

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

  // Update Average Price Line on Chart
  useEffect(() => {
    if (!seriesRef.current) return;
    if (avgPrice > 0) {
       if (!avgLineRef.current) {
          avgLineRef.current = seriesRef.current.createPriceLine({
             price: avgPrice,
             color: "#10b981",
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
    setTrades([]);
    
    // reset chart data
    if (seriesRef.current) {
       timeEngineRef.current = Math.floor(Date.now() / 1000);
       seriesRef.current.setData([{ time: timeEngineRef.current as Time, value: StartingPrice }]);
    }
  };

  const buyStock = (amountToInvest: number) => {
    if (amountToInvest > capital) amountToInvest = capital;
    if (amountToInvest <= 0) return;

    const currentLive = priceEngineRef.current;
    const sharesToBuy = Math.floor(amountToInvest / currentLive);
    const actualCost = sharesToBuy * currentLive;

    setCapital((prev) => prev - actualCost);
    setTotalInvested((prev) => prev + actualCost);
    setTotalShares((prev) => prev + sharesToBuy);
    setTrades([...trades, { price: Math.floor(currentLive), shares: sharesToBuy, type: "buy" }]);

    // Mark buy on chart
    if (seriesRef.current) {
       seriesRef.current.setMarkers([
          {
             time: timeEngineRef.current as Time,
             position: 'belowBar',
             color: '#3b82f6',
             shape: 'arrowUp',
             text: 'Buy',
          }
       ]);
    }
  };

  const cutLoss = () => {
    const currentLive = priceEngineRef.current;
    const finalEquity = totalShares * currentLive;
    
    setCapital((prev) => prev + finalEquity);
    setTotalInvested(0);
    setTotalShares(0);
    setTrades([...trades, { price: Math.floor(currentLive), shares: totalShares, type: "sell" }]);

    // Mark sell on chart
    if (seriesRef.current) {
       seriesRef.current.setMarkers([
          {
             time: timeEngineRef.current as Time,
             position: 'aboveBar',
             color: '#ef4444',
             shape: 'arrowDown',
             text: profitLoss < 0 ? 'Cut Loss' : 'Take Profit',
          }
       ]);
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

      {/* Interaktif Simulator - Visible under all tabs */}
      <GlassCard hover={false} className="!p-5 sm:!p-8 relative mt-10" style={{ border: "1px solid rgba(59,130,246,0.3)" }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6" style={{ borderBottom: "1px solid rgba(226,232,240,0.1)" }}>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">🕹️ Live Trading Simulator</h2>
            <p className="text-xs text-silver-400 mt-1">Sisa Modal Saldo: <strong className="text-silver-200">{formatRupiah(capital)}</strong></p>
          </div>
          <button onClick={resetSim} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20">
            <IconRefresh className="w-3.5 h-3.5" /> Ulangi Simulasi
          </button>
        </div>

        {/* LIVE CHART */}
        <div className="w-full h-80 sm:h-96 rounded-2xl mb-6 overflow-hidden border border-white/5 relative bg-black/20" ref={chartContainerRef}>
          {/* Chart mounts here */}
          <div className="absolute top-4 left-4 z-10 pointers-events-none p-3 rounded-lg bg-black/50 backdrop-blur border border-white/10">
            <div className="text-xs text-silver-400 mb-1 uppercase tracking-widest">Saham Virtual (MOCK)</div>
            <div className={`text-2xl font-black ${currentPrice > StartingPrice ? 'text-emerald-400' : 'text-red-400'}`}>
              Rp {currentPrice.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Kolom Kiri: Portofolio State */}
          <div className="md:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3 shadow-inner">
              <h3 className="text-xs font-bold text-silver-400 uppercase tracking-widest text-center">Portofolio Saat Ini</h3>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-xs text-silver-400">Avg. Harga (Modal)</span>
                <span className="text-lg font-bold text-blue-400">Rp {Math.floor(avgPrice)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-xs text-silver-400">Total Lot (Saham)</span>
                <span className="text-base font-bold text-silver-200">{totalShares} Lembar</span>
              </div>
              <div className="flex justify-between items-end pt-1">
                <span className="text-xs text-silver-400">Total P/L</span>
                <div className="text-right">
                  <motion.div
                    key={profitLoss}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className={`text-xl font-black ${profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {profitLoss >= 0 ? "+" : ""}{formatRupiah(profitLoss)}
                  </motion.div>
                  <div className={`text-xs font-bold mt-1 ${profitLossPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    ({profitLossPercent >= 0 ? "+" : ""}{profitLossPercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            </div>

            {totalShares > 0 && (
               <button
                  onClick={cutLoss}
                  className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-500/20 transition-all flex justify-center items-center gap-2"
                >
                 <IconShield className="w-4 h-4" /> 
                 {profitLoss < 0 ? "CUT LOSS (Terima Kerugian" : "TAKE PROFIT (Jual Semua"} & Kembali Modal)
               </button>
            )}
            
            {totalShares === 0 && trades.length > 0 && (
              <div className="text-center p-3 text-xs text-silver-300 rounded-xl bg-green-500/10 border border-green-500/20">
                 Semua saham berhasil dijual. Cek sisa modal saldomu di atas untuk melihat untung ruginya.
              </div>
            )}
          </div>

          {/* Kolom Kanan: Actions Console */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointers-events-none" />
                <h4 className="text-xs font-bold text-silver-400 mb-2 flex items-center gap-1.5"><IconTrendingUp className="w-4 h-4 text-green-400" /> Katalis Market Naik</h4>
                <div className="flex gap-2">
                  <button onClick={() => simulateMarket("up", 2)} className="flex-1 py-1.5 text-[11px] font-bold bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">+2% Spike</button>
                  <button onClick={() => simulateMarket("up", 5)} className="flex-1 py-1.5 text-[11px] font-bold bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">+5% Pump</button>
                  <button onClick={() => simulateMarket("up", 10)} className="flex-1 py-1.5 text-[11px] font-bold bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">ARA!</button>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointers-events-none" />
                <h4 className="text-xs font-bold text-silver-400 mb-2 flex items-center gap-1.5"><IconTrendingDown className="w-4 h-4 text-red-400" /> Katalis Market Panik</h4>
                <div className="flex gap-2">
                  <button onClick={() => simulateMarket("down", 2)} className="flex-1 py-1.5 text-[11px] font-bold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">-2% Drop</button>
                  <button onClick={() => simulateMarket("down", 5)} className="flex-1 py-1.5 text-[11px] font-bold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">-5% Dump</button>
                  <button onClick={() => simulateMarket("down", 10)} className="flex-1 py-1.5 text-[11px] font-bold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">ARB!</button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4 flex-1">
              <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                 ⚡ Eksekusi Order
              </h4>
              <p className="text-xs text-silver-400 leading-relaxed">Pilih berapa alokasi uang (dari Sisa Modalmu) yang akan dipakai untuk membeli Saham Virtual di harga live detik ini:</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  disabled={capital < 1000000}
                  onClick={() => buyStock(1000000)}
                  className="py-3 rounded uppercase tracking-wider shadow shadow-blue-500/20 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:shadow-none font-bold text-[10px] sm:text-xs text-white transition-all transform hover:-translate-y-0.5"
                >
                  Beli Rp 1 Juta
                </button>
                 <button
                  disabled={capital < 3000000}
                  onClick={() => buyStock(3000000)}
                  className="py-3 rounded uppercase tracking-wider shadow shadow-blue-500/20 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:shadow-none font-bold text-[10px] sm:text-xs text-white transition-all transform hover:-translate-y-0.5"
                >
                  Beli Rp 3 Juta
                </button>
                 <button
                  disabled={capital < 5000000}
                  onClick={() => buyStock(5000000)}
                  className="py-3 rounded uppercase tracking-wider shadow shadow-blue-500/20 bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:shadow-none font-bold text-[10px] sm:text-xs text-white transition-all transform hover:-translate-y-0.5"
                >
                  Beli Rp 5 Juta
                </button>
                 <button
                  disabled={capital <= 0}
                  onClick={() => buyStock(capital)}
                  className="py-3 rounded uppercase tracking-wider shadow shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:shadow-none font-bold text-[10px] sm:text-xs text-white transition-all transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-0.5"
                >
                  <span>All In Sisa Saldo</span>
                </button>
              </div>

              {trades.length > 0 && (
                <div className="mt-5 pt-4 border-t border-blue-500/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-silver-400 mb-3">Histori Transaksi (Mencicil)</p>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {trades.map((t, i) => (
                      <span key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium border ${t.type === 'buy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {t.type === 'buy' ? <IconTrendingUp className="w-3 h-3" /> : <IconTrendingDown className="w-3 h-3" />}
                        {t.type === 'buy' ? 'Beli' : 'Jual'} {t.shares.toLocaleString()} Lbr @ Rp {t.price.toLocaleString("id-ID")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </GlassCard>
    </div>
  );
}
