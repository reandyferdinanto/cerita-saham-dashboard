
"use client";

import { useEffect, useState, useCallback, use, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { StockQuote, OHLCData } from "@/lib/types";

const CandlestickChart = dynamic(
  () => import("@/components/charts/CandlestickChart"),
  { ssr: false }
);

function BotViewContent({ tickerParam }: { tickerParam: Promise<{ ticker: string }> }) {
  const { ticker } = use(tickerParam);
  const decodedTicker = decodeURIComponent(ticker);
  
  const searchParams = useSearchParams();
  const interval = searchParams?.get("interval") || "1d";

  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [history, setHistory] = useState<OHLCData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuote = useCallback(async () => {
    try {
      const tickerJK = decodedTicker.toUpperCase().endsWith(".JK") ? decodedTicker.toUpperCase() : `${decodedTicker.toUpperCase()}.JK`;
      const res = await fetch(`/api/stocks/quote/${encodeURIComponent(tickerJK)}`);
      const data = await res.json();
      if (!data.error) setQuote(data);
      return data.price;
    } catch { return null; }
  }, [decodedTicker]);

  const fetchHistory = useCallback(async (livePrice?: number) => {
    try {
      let range = "6mo";
      if (interval === "1m") range = "1d";
      else if (interval === "5m" || interval === "15m") range = "5d";
      else if (interval === "1h" || interval === "4h") range = "1mo";

      const tickerJK = decodedTicker.toUpperCase().endsWith(".JK") ? decodedTicker.toUpperCase() : `${decodedTicker.toUpperCase()}.JK`;
      const res = await fetch(
        `/api/stocks/history/${encodeURIComponent(tickerJK)}?range=${range}&interval=${interval}`
      );
      const data: OHLCData[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (livePrice && (interval === "1d" || interval === "1wk" || interval === "1mo")) {
          const last = { ...data[data.length - 1] };
          last.close = livePrice;
          data[data.length - 1] = last;
        }
        setHistory(data.filter((d) => d.close != null));
      }
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setLoading(false);
    }
  }, [decodedTicker, interval]);

  useEffect(() => {
    fetchQuote().then((price) => fetchHistory(price));
  }, [fetchQuote, fetchHistory]);

  if (loading) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center text-silver-500 z-[9999]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        <p className="font-bold tracking-widest uppercase text-xs">Loading Chart Data...</p>
      </div>
    </div>
  );

  const isPositive = (quote?.change || 0) >= 0;

  return (
    <div className="fixed inset-0 bg-black p-8 w-[1000px] h-[1050px] text-silver-100 flex flex-col gap-8 z-[9999] overflow-hidden" id="capture-area">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hide all UI elements except the capture area */
        .overflow-x-auto, .pb-1, .scrollbar-hide, nav, footer, .AdminAssistantPopup { display: none !important; }
        body { background: black !important; }
      `}} />
      
      <div className="flex justify-between items-end border-b-2 border-white/10 pb-6">
        <div>
          <h1 className="text-7xl font-black tracking-tighter italic">{decodedTicker.replace(".JK", "").toUpperCase()}</h1>
          <p className="text-silver-500 text-xl font-bold uppercase mt-2 tracking-[0.2em]">{quote?.name || decodedTicker} ({interval.toUpperCase()})</p>
        </div>
        <div className="text-right">
          <p className="text-7xl font-black tracking-tighter">{quote?.price?.toLocaleString("id-ID") || "—"}</p>
          <p className={`text-3xl font-black ${isPositive ? "text-green-500" : "text-red-400"}`}>
            {isPositive ? "▲" : "▼"} {Math.abs(quote?.change || 0).toFixed(0)} ({Math.abs(quote?.changePercent || 0).toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {[
          { label: "OPEN", value: quote?.open },
          { label: "HIGH", value: quote?.high },
          { label: "LOW", value: quote?.low },
          { label: "PREV", value: quote?.previousClose },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border-2 border-white/10 p-5 rounded-[32px] flex flex-col items-center justify-center">
            <p className="text-xs text-silver-500 font-black mb-1 uppercase tracking-widest">{s.label}</p>
            <p className="text-3xl font-black text-silver-100">{s.value?.toLocaleString("id-ID") || "—"}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 bg-white/5 border-2 border-white/10 rounded-[48px] p-8 relative overflow-hidden">
        {/* Timeframe Badge */}
        <div className="absolute top-8 left-8 bg-black/40 px-4 py-2 rounded-2xl border border-white/10 z-10 backdrop-blur-md flex flex-col items-center justify-center">
          <span className="text-silver-400 text-[10px] font-black tracking-[0.2em] uppercase">TIMEFRAME</span>
          <span className="text-orange-500 text-3xl font-black mt-0.5">{interval.toUpperCase()}</span>
        </div>

        {history.length > 0 ? (
          <CandlestickChart data={history} height={600} />
        ) : (
          <div className="h-full flex items-center justify-center text-silver-600 font-bold uppercase tracking-widest italic text-2xl">No Data Found</div>
        )}
      </div>

      <div className="flex justify-between items-center border-t-2 border-white/5 pt-6">
        <div className="flex items-center gap-3">
           <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
           <span className="text-xs text-silver-500 font-black uppercase tracking-[0.4em]">Anomali Saham Dashboard</span>
        </div>
        <span className="text-xs text-silver-600 font-bold uppercase tracking-widest">
          {new Date().toLocaleString("id-ID", { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB
        </span>
      </div>
    </div>
  );
}

export default function StockBotViewPage({ params }: { params: Promise<{ ticker: string }> }) {
  return (
    <Suspense fallback={<div className="bg-black fixed inset-0"></div>}>
      <BotViewContent tickerParam={params} />
    </Suspense>
  );
}
