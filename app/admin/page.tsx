"use client";

import { useEffect, useState, useCallback } from "react";
import GlassCard from "@/components/ui/GlassCard";
import AddStockForm from "@/components/watchlist/AddStockForm";
import { WatchlistEntry } from "@/lib/types";

export default function AdminPage() {
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
      setWatchlist(data);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
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
      const res = await fetch(
        `/api/watchlist/${encodeURIComponent(ticker)}`,
        { method: "DELETE" }
      );
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
      const res = await fetch(
        `/api/watchlist/${encodeURIComponent(editingTicker)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tp: editForm.tp ? parseFloat(editForm.tp) : null,
            sl: editForm.sl ? parseFloat(editForm.sl) : null,
            bandarmology: editForm.bandarmology,
          }),
        }
      );
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
      <div>
        <h1 className="text-3xl font-bold text-silver-100">
          Admin <span className="text-orange-400">Panel</span>
        </h1>
        <p className="text-silver-500 text-sm mt-1">
          Kelola watchlist saham, level TP/SL, dan catatan analisis
        </p>
      </div>

      {/* Add Stock Form */}
      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <h2 className="text-lg font-bold text-silver-200">Tambah Saham Baru</h2>
        </div>
        <AddStockForm onAdd={handleAdd} />
      </GlassCard>

      {/* Watchlist Management Table */}
      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h2 className="text-lg font-bold text-silver-200">
            Kelola Watchlist ({watchlist.length} saham)
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-silver-500/5 rounded-xl animate-pulse"
              ></div>
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-silver-400">
              Belum ada saham. Tambah saham pertama kamu di atas!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlist.map((entry) => (
              <div key={entry.ticker} className="glass rounded-xl p-4">
                {editingTicker === entry.ticker ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-orange-400">
                        Edit: {entry.ticker.replace(".JK", "")}
                        <span className="text-sm font-normal text-silver-500 ml-2">
                          {entry.name}
                        </span>
                      </h3>
                      <button
                        onClick={() => setEditingTicker(null)}
                        className="text-silver-500 hover:text-silver-300 text-sm flex items-center gap-1"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                        Batal
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-silver-500 uppercase">
                          Take Profit
                        </label>
                        <input
                          type="number"
                          value={editForm.tp}
                          onChange={(e) =>
                            setEditForm({ ...editForm, tp: e.target.value })
                          }
                          className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-silver-500 uppercase">
                          Stop Loss
                        </label>
                        <input
                          type="number"
                          value={editForm.sl}
                          onChange={(e) =>
                            setEditForm({ ...editForm, sl: e.target.value })
                          }
                          className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-silver-500 uppercase">
                        Notes
                      </label>
                      <textarea
                        value={editForm.bandarmology}
                        onChange={(e) =>
                          setEditForm({ ...editForm, bandarmology: e.target.value })
                        }
                        rows={2}
                        className="glass-input w-full px-3 py-2 text-sm text-silver-200 mt-1 resize-none"
                      />
                    </div>
                    <button
                      onClick={handleUpdate}
                      className="glass-button px-4 py-2 text-sm flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                        />
                      </svg>
                      Simpan Perubahan
                    </button>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold text-silver-200">
                          {entry.ticker.replace(".JK", "")}
                        </h3>
                        <span className="text-xs text-silver-500">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {entry.tp && (
                          <span className="text-xs text-green-400">
                            TP: {entry.tp.toLocaleString("id-ID")}
                          </span>
                        )}
                        {entry.sl && (
                          <span className="text-xs text-red-400">
                            SL: {entry.sl.toLocaleString("id-ID")}
                          </span>
                        )}
                        {entry.bandarmology && (
                          <span className="text-xs text-orange-400 truncate max-w-[200px]">
                            {entry.bandarmology}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-silver-400 hover:text-orange-400 hover:bg-orange-500/10 border border-transparent hover:border-orange-500/20 transition-all"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      {deleteConfirm === entry.ticker ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(entry.ticker)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20"
                          >
                            Konfirmasi
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 rounded-lg text-xs text-silver-500"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(entry.ticker)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-silver-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
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

