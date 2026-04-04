"use client";

import { useState, useEffect, useRef } from "react";

interface AddStockFormProps {
  initialData?: {
    ticker?: string;
    name?: string;
    tp?: number | null;
    sl?: number | null;
    bandarmology?: string;
  };
  onAdd: (stock: {
    ticker: string;
    name: string;
    tp: number | null;
    sl: number | null;
    bandarmology: string;
  }) => Promise<void>;
}

export default function AddStockForm({ onAdd, initialData }: AddStockFormProps) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [nameFetching, setNameFetching] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [bandarmology, setBandarmology] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialData) return;
    setTicker(initialData.ticker?.replace(/\.JK$/i, "") || "");
    setName(initialData.name || "");
    setTp(initialData.tp != null ? String(initialData.tp) : "");
    setSl(initialData.sl != null ? String(initialData.sl) : "");
    setBandarmology(initialData.bandarmology || "");
  }, [initialData]);

  useEffect(() => {
    const raw = ticker.trim().toUpperCase();
    if (raw.length < 2) { setName(""); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const symbol = raw.endsWith(".JK") ? raw : raw + ".JK";
      setNameFetching(true);
      try {
        const res = await fetch(`/api/stocks/quote/${encodeURIComponent(symbol)}`);
        const data = await res.json();
        if (data?.name && !data.error) {
          setName(data.name);
        } else {
          setName("");
        }
      } catch {
        setName("");
      } finally {
        setNameFetching(false);
      }
    }, 600);
  }, [ticker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) { setError("Ticker wajib diisi"); return; }
    setLoading(true);
    setError("");
    try {
      const symbol = ticker.toUpperCase().endsWith(".JK")
        ? ticker.toUpperCase()
        : ticker.toUpperCase() + ".JK";
      await onAdd({
        ticker: symbol,
        name: name || symbol,
        tp: tp ? parseFloat(tp) : null,
        sl: sl ? parseFloat(sl) : null,
        bandarmology,
      });
      setTicker(""); setName(""); setTp(""); setSl(""); setBandarmology("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-silver-400 mb-1 font-medium">
            Ticker <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="cth. BBCA"
            className="glass-input w-full px-4 py-3 text-sm text-silver-200 placeholder:text-silver-500 uppercase"
          />
        </div>

        <div>
          <label className="block text-xs text-silver-400 mb-1 font-medium flex items-center gap-1.5">
            Company Name
            {nameFetching && (
              <span className="inline-block w-3 h-3 border border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            )}
            {!nameFetching && name && (
              <span className="text-[10px] text-green-500 font-normal">auto-filled</span>
            )}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Otomatis dari ticker..."
            className="glass-input w-full px-4 py-3 text-sm placeholder:text-silver-500"
            style={{ color: name ? "#e2e8f0" : undefined }}
            readOnly={nameFetching}
          />
        </div>

        <div>
          <label className="block text-xs text-silver-400 mb-1 font-medium">
            Take Profit (TP)
          </label>
          <input
            type="number"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder="Target harga"
            className="glass-input w-full px-4 py-3 text-sm text-silver-200 placeholder:text-silver-500"
          />
        </div>

        <div>
          <label className="block text-xs text-silver-400 mb-1 font-medium">
            Stop Loss (SL)
          </label>
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder="Harga stop loss"
            className="glass-input w-full px-4 py-3 text-sm text-silver-200 placeholder:text-silver-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-silver-400 mb-1 font-medium">
          Notes
        </label>
        <textarea
          value={bandarmology}
          onChange={(e) => setBandarmology(e.target.value)}
          placeholder="Catatan analisis, akumulasi/distribusi, foreign flow..."
          rows={3}
          className="glass-input w-full px-4 py-3 text-sm text-silver-200 placeholder:text-silver-500 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="glass-button px-6 py-3 text-sm w-full md:w-auto disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            Menambahkan...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Tambah ke Watchlist
          </>
        )}
      </button>
    </form>
  );
}
