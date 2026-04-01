"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "@/components/ui/GlassCard";
import AddStockForm from "@/components/watchlist/AddStockForm";
import { WatchlistEntry } from "@/lib/types";

export default function AdminWatchlistPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    tp: string;
    sl: string;
    bandarmology: string;
  }>({ tp: "", sl: "", bandarmology: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setWatchlist(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      setWatchlist([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleAdd = async (stock: {
    ticker: string;
    name: string;
    tp: number | null;
    sl: number | null;
    bandarmology: string;
  }) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add stock");
    }
    const data = await res.json();
    setWatchlist(data);
  };

  const handleDelete = async (ticker: string) => {
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (error) {
      console.error("Error deleting stock:", error);
    }
    setDeleteConfirm(null);
  };

  const handleEdit = (entry: WatchlistEntry) => {
    setEditingTicker(entry.ticker);
    setEditForm({
      tp: entry.tp?.toString() || "",
      sl: entry.sl?.toString() || "",
      bandarmology: entry.bandarmology || "",
    });
  };

  const handleUpdate = async () => {
    if (!editingTicker) return;
    try {
      const res = await fetch(`/api/watchlist/${encodeURIComponent(editingTicker)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tp: editForm.tp ? parseFloat(editForm.tp) : null,
          sl: editForm.sl ? parseFloat(editForm.sl) : null,
          bandarmology: editForm.bandarmology,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
        setEditingTicker(null);
      }
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  return (
    <div className="space-y-6">
      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <h2 className="text-lg font-bold text-silver-200">Tambah Saham Baru</h2>
        </div>
        <AddStockForm onAdd={handleAdd} />
      </GlassCard>

      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-lg font-bold text-silver-200">Kelola Watchlist ({watchlist.length} saham)</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-silver-500/5 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-silver-400">Belum ada saham. Tambah saham pertama kamu di atas!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlist.map((entry) => (
              <div key={entry.ticker} className="glass rounded-xl p-4">
                {editingTicker === entry.ticker ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-orange-400">
                        Edit: {entry.ticker.replace(".JK", "")}
                        <span className="text-sm font-normal text-silver-500 ml-2">{entry.name}</span>
                      </h3>
                      <button onClick={() => setEditingTicker(null)} className="text-silver-500 hover:text-silver-300 text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Batal
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-silver-500 uppercase">Take Profit</label>
                        <input
                          type="number"
                          value={editForm.tp}
                          onChange={(e) => setEditForm({ ...editForm, tp: e.target.value })}
                          className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-silver-500 uppercase">Stop Loss</label>
                        <input
                          type="number"
                          value={editForm.sl}
                          onChange={(e) => setEditForm({ ...editForm, sl: e.target.value })}
                          className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-silver-500 uppercase">Notes</label>
                      <textarea
                        value={editForm.bandarmology}
                        onChange={(e) => setEditForm({ ...editForm, bandarmology: e.target.value })}
                        rows={2}
                        className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1 resize-none"
                      />
                    </div>
                    <button onClick={handleUpdate} className="glass-button px-4 py-2 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Simpan Perubahan
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-orange-400">{entry.ticker.replace(".JK", "")}</h3>
                        <span className="text-sm text-silver-400">{entry.name}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-silver-500 text-[10px] uppercase mb-1">Take Profit</p>
                          <p className="text-green-400 font-semibold">{entry.tp ? entry.tp.toLocaleString("id-ID") : "-"}</p>
                        </div>
                        <div>
                          <p className="text-silver-500 text-[10px] uppercase mb-1">Stop Loss</p>
                          <p className="text-red-400 font-semibold">{entry.sl ? entry.sl.toLocaleString("id-ID") : "-"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-silver-500 text-[10px] uppercase mb-1">Bandarmology</p>
                          <p className="text-silver-300 text-sm">{entry.bandarmology || "-"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleEdit(entry)} className="glass-button px-3 py-1.5 text-xs">
                        Edit
                      </button>
                      {deleteConfirm === entry.ticker ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(entry.ticker)} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                            Yakin?
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-silver-400">
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(entry.ticker)} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
