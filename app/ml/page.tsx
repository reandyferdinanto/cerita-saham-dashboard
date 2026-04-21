"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, Brain, TrendingUp, TrendingDown, Activity, ActivitySquare, Loader2, RefreshCw, Zap } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NavbarWrapper from "@/components/ui/NavbarWrapper";
import { OHLCData } from "@/lib/types";

// SSR false because lightweight-charts only works in browser
const CandlestickChart = dynamic(() => import("@/components/charts/CandlestickChart"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-white/5 rounded-xl border border-white/10">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  )
});

interface MLPredictionData {
  ticker: string;
  prediction: "NAIK" | "TURUN / TETAP";
  probability: number;
  accuracy: number;
  indicators: {
    rsi: number;
    ma_ratio: number;
    vol_ratio: number;
  };
  historical_data: OHLCData[];
}

interface ScreenerResult {
  ticker: string;
  name: string;
  price: number;
  probability: number;
  rsi: number;
  ma_ratio: number;
}

interface ScreenerData {
  count: number;
  results: ScreenerResult[];
  timestamp: string;
}

export default function MachineLearningPage() {
  const [tickerInput, setTickerInput] = useState("BBCA");
  const [isLoading, setIsLoading] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [data, setData] = useState<MLPredictionData | null>(null);
  const [screenerData, setScreenerData] = useState<ScreenerData | null>(null);
  const [priceBucket, setPriceBucket] = useState("under300");
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async (e?: React.FormEvent, tickerOverride?: string) => {
    if (e) e.preventDefault();
    const targetTicker = tickerOverride || tickerInput;
    if (!targetTicker.trim()) return;

    if (tickerOverride) {
      setTickerInput(targetTicker);
      // Scroll to top to see prediction
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const cleanTicker = targetTicker.trim().toUpperCase().replace('.JK', '');
      const response = await fetch(`/api/ml/predict?ticker=${cleanTicker}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Terjadi kesalahan saat memproses data.");
      }

      setData(result);
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const runScreener = async () => {
    setIsScreening(true);
    setError(null);
    try {
      const response = await fetch(`/api/ml/screener?bucket=${priceBucket}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menjalankan screener");
      setScreenerData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScreening(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(14% 0.02 160)" }}>
      <NavbarWrapper />
      
      <main className="max-w-6xl mx-auto px-4 py-8 mt-16 pb-24">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12 space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl mb-2" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            <Brain className="w-8 h-8" style={{ color: "oklch(65% 0.2 150)" }} />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: "oklch(95% 0.01 160)" }}>
            A.I. Stock Predictor
          </h1>
          <p className="text-sm md:text-base max-w-2xl" style={{ color: "oklch(75% 0.02 160)" }}>
            Model Machine Learning berbasis Random Forest yang menganalisis pola indikator teknikal (RSI, Moving Averages, Momentum Volume) untuk memprediksi arah harga H+1.
          </p>
        </div>

        {/* Action Bar: Search & Screener Trigger */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 max-w-4xl mx-auto">
          {/* Search Bar */}
          <form onSubmit={fetchPrediction} className="flex-1 relative">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-emerald-500/50 group-focus-within:text-emerald-400 transition-colors" />
              </div>
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                placeholder="Cek saham (BBCA, ASII)..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-32 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-inner uppercase font-mono tracking-wider"
                style={{ focusRingColor: "oklch(65% 0.2 150)" } as any}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute inset-y-2 right-2 px-6 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
                style={{ backgroundColor: "oklch(70% 0.15 45)", color: "oklch(14% 0.02 160)" }}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analisa"}
              </button>
            </div>
          </form>

          {/* Screener Button Group */}
          <div className="flex gap-2">
            <select 
              value={priceBucket}
              onChange={(e) => setPriceBucket(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:border-transparent transition-all uppercase font-mono text-sm"
              style={{ focusRingColor: "oklch(65% 0.2 150)" } as any}
            >
              <option value="all">Semua Harga</option>
              <option value="under200">Di Bawah 200</option>
              <option value="under300">Di Bawah 300</option>
              <option value="200to500">200 - 500</option>
              <option value="above500">Di Atas 500</option>
            </select>
            <button
              onClick={runScreener}
              disabled={isScreening}
              className="px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg border border-white/5 whitespace-nowrap"
              style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "oklch(65% 0.2 150)" }}
            >
              {isScreening ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Screening...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-current" />
                  Run Screener
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-xl mx-auto mb-8 p-4 rounded-xl flex items-center gap-3 border" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", color: "oklch(60% 0.2 25)" }}>
            <ActivitySquare className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Result Area */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            
            {/* Left Column: Prediction Info */}
            <div className="lg:col-span-1 space-y-6">
              <GlassCard className="p-6 relative overflow-hidden flex flex-col h-full justify-center">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Brain className="w-32 h-32" />
                </div>
                
                <h3 className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "oklch(75% 0.02 160)" }}>Prediksi H+1 untuk</h3>
                <h2 className="text-4xl font-black mb-6 font-mono tracking-tight text-white">{data.ticker}</h2>
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-sm text-gray-400">Arah</span>
                    <div className="flex items-center gap-2 font-bold text-lg">
                      {data.prediction === "NAIK" ? (
                        <span className="flex items-center gap-1.5" style={{ color: "oklch(65% 0.2 150)" }}>
                          <TrendingUp className="w-5 h-5" /> NAIK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5" style={{ color: "oklch(60% 0.2 25)" }}>
                          <TrendingDown className="w-5 h-5" /> TURUN/TETAP
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-sm text-gray-400">Probabilitas</span>
                    <span className="font-bold text-lg text-white">{data.probability}%</span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-sm text-gray-400">Akurasi Model</span>
                    <span className="font-bold text-lg text-white">{data.accuracy}%</span>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Right Column: Chart & Indicators */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Technical Indicators */}
              <div className="grid grid-cols-3 gap-4">
                <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">RSI (14)</span>
                  <span className={`text-xl font-bold font-mono ${data.indicators.rsi > 70 ? 'text-red-400' : data.indicators.rsi < 30 ? 'text-emerald-400' : 'text-white'}`}>
                    {data.indicators.rsi}
                  </span>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Tren (MA5/20)</span>
                  <span className={`text-xl font-bold font-mono ${data.indicators.ma_ratio > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.indicators.ma_ratio}
                  </span>
                </GlassCard>
                <GlassCard className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Vol Momentum</span>
                  <span className={`text-xl font-bold font-mono ${data.indicators.vol_ratio > 1 ? 'text-emerald-400' : 'text-white'}`}>
                    {data.indicators.vol_ratio}
                  </span>
                </GlassCard>
              </div>

              {/* Chart */}
              <GlassCard className="p-4">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <Activity className="w-5 h-5" style={{ color: "oklch(65% 0.2 150)" }} />
                  <h3 className="font-semibold text-white">Riwayat Harga & Indikator (60 Hari)</h3>
                </div>
                <CandlestickChart 
                  data={data.historical_data} 
                  height={400} 
                  mobileHeight={300} 
                />
              </GlassCard>

            </div>
          </div>
        )}

        {/* Screener Results Section */}
        {(screenerData || isScreening) && (
          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <ActivitySquare className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">ML Screener Results</h2>
                  <p className="text-sm text-gray-400">
                    {priceBucket === 'all' ? 'Semua saham' : 
                     priceBucket === 'under200' ? 'Saham < Rp200' :
                     priceBucket === 'under300' ? 'Saham < Rp300' :
                     priceBucket === '200to500' ? 'Saham Rp200 - Rp500' :
                     'Saham > Rp500'} dengan probabilitas naik tertinggi
                  </p>
                </div>
              </div>
              <button 
                onClick={runScreener}
                disabled={isScreening}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isScreening ? 'animate-spin' : ''}`} />
                Refresh List
              </button>
            </div>

            {isScreening && !screenerData && (
              <GlassCard className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Sedang Memindai Pasar...</h3>
                  <p className="text-sm text-gray-400 max-w-md">Model AI sedang menganalisis ratusan saham Indonesia untuk mencari peluang terbaik berdasarkan kriteria yang dipilih.</p>
                </div>
              </GlassCard>
            )}

            {screenerData && (
              <GlassCard className="overflow-hidden border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/20">
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">Ticker</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">Nama Perusahaan</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">Harga</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">Probabilitas Naik</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">RSI (14)</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold">Tren (MA)</th>
                        <th className="px-6 py-4 text-xs uppercase tracking-wider text-gray-400 font-bold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {screenerData.results.map((item) => (
                        <tr key={item.ticker} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-lg text-emerald-400 group-hover:text-emerald-300 transition-colors cursor-pointer" onClick={() => fetchPrediction(undefined, item.ticker)}>
                              {item.ticker}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-300 font-medium line-clamp-1 max-w-[200px]">{item.name}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-white">Rp{item.price}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${item.probability}%` }}
                                />
                              </div>
                              <span className="font-bold text-emerald-400">{item.probability}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-mono ${item.rsi < 30 ? 'text-emerald-400' : item.rsi > 70 ? 'text-red-400' : 'text-gray-300'}`}>
                              {item.rsi}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-gray-300">{item.ma_ratio}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => fetchPrediction(undefined, item.ticker)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              Detail Analisa
                            </button>
                          </td>
                        </tr>
                      ))}
                      {screenerData.results.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                            Tidak ada saham yang memenuhi kriteria saat ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 bg-black/20 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Terakhir diperbarui: {new Date(screenerData.timestamp).toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{screenerData.count} saham ditemukan</span>
                </div>
              </GlassCard>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
