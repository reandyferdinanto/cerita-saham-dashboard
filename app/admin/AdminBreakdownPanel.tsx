"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OHLCData, SearchResult } from "@/lib/types";

const AdminBreakdownChart = dynamic(() => import("@/app/admin/AdminBreakdownChart"), {
  ssr: false,
  loading: () => <div className="h-[300px] rounded-2xl bg-silver-100/[0.035] sm:h-[350px] lg:h-[430px] lg:rounded-3xl" />,
});

const IntradayMiniChart = dynamic(() => import("@/app/admin/IntradayMiniChart"), {
  ssr: false,
  loading: () => <div className="h-[180px] rounded-xl bg-silver-100/[0.035]" />,
});

type BreakdownContextRow = {
  index: number;
  date: string;
  relation: string;
  open: number;
  high: number;
  low: number;
  close: number;
  selected: boolean;
};

type SavedBreakdown = {
  id: string;
  ticker: string;
  name: string;
  selectedDate: string;
  note: string;
  createdAt: string;
  rows: BreakdownContextRow[];
};

const STORAGE_KEY = "admin_breakdown_high_low_list";

function formatPrice(value: number) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function normalizeTicker(value: string) {
  const code = value.trim().toUpperCase().replace(/\.JK$/i, "");
  return code ? `${code}.JK` : "";
}

function formatDate(value: string | number) {
  if (typeof value === "number") {
    return new Date(value * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(value: string | number) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  const parsed = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPosition(row: BreakdownContextRow, rows: BreakdownContextRow[]) {
  const selected = rows.find((item) => item.selected);
  if (selected) {
    const distance = row.index - selected.index;
    return distance > 0 ? `+${distance}` : String(distance);
  }

  if (row.selected || row.relation === "Candle dipilih") return "0";
  const before = row.relation.match(/^(\d+) candle sebelum$/);
  if (before) return `-${before[1]}`;
  const after = row.relation.match(/^(\d+) candle setelah$/);
  if (after) return `+${after[1]}`;
  return row.relation;
}

function buildRows(history: OHLCData[], selectedIndex: number | null): BreakdownContextRow[] {
  if (selectedIndex == null || !history[selectedIndex]) return [];

  const start = Math.max(0, selectedIndex - 5);
  const end = Math.min(history.length - 1, selectedIndex + 5);

  return history.slice(start, end + 1).map((item, offset) => {
    const index = start + offset;
    const distance = index - selectedIndex;
    const relation = distance === 0
      ? "Candle dipilih"
      : distance < 0
        ? `${Math.abs(distance)} candle sebelum`
        : `${distance} candle setelah`;

    return {
      index,
      date: String(item.time),
      relation,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      selected: index === selectedIndex,
    };
  });
}

function CandleRowCards({
  rows,
  onOpen,
  actionLabel,
}: {
  rows: BreakdownContextRow[];
  onOpen?: (row: BreakdownContextRow) => void;
  actionLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-silver-200/10 px-4 py-8 text-center text-sm text-silver-600">
        Klik candle di chart.
      </div>
    );
  }

  return (
    <div className="space-y-2 md:hidden">
      {rows.map((row) => (
        <div
          key={`${row.date}-${row.index}`}
          className="rounded-2xl border border-silver-200/10 p-3"
          style={{ background: row.selected ? "rgba(251,146,60,0.14)" : "rgba(255,255,255,0.025)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="text-left text-sm font-black text-orange-200 underline-offset-4 hover:text-orange-100 hover:underline"
                >
                  {formatShortDate(row.date)}
                </button>
              ) : (
                <p className="text-sm font-black text-silver-100">{formatShortDate(row.date)}</p>
              )}
              <p className="mt-1 text-xs text-silver-500">Posisi {formatPosition(row, rows)}</p>
            </div>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="shrink-0 rounded-lg border border-orange-200/15 bg-orange-100/10 px-2.5 py-1.5 text-[10px] font-bold text-orange-200"
              >
                {actionLabel ?? "Buka"}
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-300/[0.055] px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.12em] text-emerald-300/70">H</p>
              <p className="mt-0.5 text-xs font-black text-emerald-300">{formatPrice(row.high)}</p>
            </div>
            <div className="rounded-xl bg-red-300/[0.055] px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.12em] text-red-300/70">L</p>
              <p className="mt-0.5 text-xs font-black text-red-300">{formatPrice(row.low)}</p>
            </div>
            <div className="rounded-xl bg-silver-100/[0.035] px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.12em] text-silver-600">Close</p>
              <p className="mt-0.5 text-xs font-black text-silver-100">{formatPrice(row.close)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminBreakdownPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [history, setHistory] = useState<OHLCData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<SavedBreakdown[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [intradayData, setIntradayData] = useState<Record<string, OHLCData[]>>({});
  const [intradayLoading, setIntradayLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedBreakdown[];
      if (Array.isArray(parsed)) setSaved(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  const contextRows = useMemo(() => buildRows(history, selectedIndex), [history, selectedIndex]);
  const selectedCandle = selectedIndex == null ? null : history[selectedIndex] ?? null;
  const beforeCount = contextRows.filter((row) => row.index < (selectedIndex ?? -1)).length;
  const afterCount = contextRows.filter((row) => row.index > (selectedIndex ?? Number.MAX_SAFE_INTEGER)).length;

  // Fetch intraday data (5m, 15m, 1h) when a candle is selected
  useEffect(() => {
    if (!selectedTicker || !selectedCandle) { setIntradayData({}); return; }
    const candleDate = String(selectedCandle.time);
    let cancelled = false;

    async function fetchIntraday() {
      setIntradayLoading(true);
      const results: Record<string, OHLCData[]> = {};
      const intervals = ["5m", "15m", "60m"] as const;

      await Promise.all(intervals.map(async (interval) => {
        try {
          const res = await fetch(`/api/stocks/history/${encodeURIComponent(selectedTicker)}?range=5d&interval=${interval}`, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          if (!Array.isArray(data)) return;
          // Filter to only the selected date
          const filtered = data.filter((item: OHLCData) => {
            const t = typeof item.time === "number" ? new Date(item.time * 1000) : new Date(item.time);
            return t.toISOString().slice(0, 10) === candleDate && item.close != null;
          });
          results[interval] = filtered;
        } catch {}
      }));

      if (!cancelled) { setIntradayData(results); setIntradayLoading(false); }
    }

    void fetchIntraday();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicker, selectedCandle?.time]);

  const searchStocks = useCallback((value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }

    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search/${encodeURIComponent(trimmed)}`, { cache: "no-store" });
        const data = await res.json();
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const loadTicker = useCallback(async (ticker: string, name = "", targetDate?: string) => {
    const normalized = normalizeTicker(ticker);
    if (!normalized) return;

    setLoadingChart(true);
    setError("");
    setHistory([]);
    setSelectedIndex(null);
    setSelectedTicker(normalized);
    setSelectedName(name || normalized.replace(".JK", ""));
    setResults([]);

    try {
      const res = await fetch(`/api/stocks/history/${encodeURIComponent(normalized)}?range=1y&interval=1d`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || "Gagal memuat data harga");
      const clean = data.filter((item: OHLCData) => item.close != null && item.high != null && item.low != null);
      setHistory(clean);
      if (clean.length > 0) {
        const targetIndex = targetDate ? clean.findIndex((item: OHLCData) => String(item.time) === targetDate) : -1;
        setSelectedIndex(targetIndex >= 0 ? targetIndex : clean.length - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat chart");
    } finally {
      setLoadingChart(false);
    }
  }, []);

  const openDirectTicker = () => {
    void loadTicker(query, query.toUpperCase().replace(/\.JK$/i, ""));
  };

  const addBreakdown = () => {
    if (!selectedTicker || !selectedCandle || contextRows.length === 0) return;

    const item: SavedBreakdown = {
      id: `${selectedTicker}-${selectedCandle.time}-${Date.now()}`,
      ticker: selectedTicker,
      name: selectedName || selectedTicker.replace(".JK", ""),
      selectedDate: String(selectedCandle.time),
      note: note.trim(),
      createdAt: new Date().toISOString(),
      rows: contextRows,
    };

    setSaved((current) => [item, ...current]);
    setNote("");
    setSaveMessage(`${selectedTicker.replace(".JK", "")} ${formatDate(selectedCandle.time)} masuk ke List Table High Low.`);
  };

  const deleteBreakdown = (id: string) => {
    setSaved((current) => current.filter((item) => item.id !== id));
  };

  const openSavedRow = (item: SavedBreakdown, row: BreakdownContextRow) => {
    setQuery(item.ticker.replace(".JK", ""));
    setSaveMessage(`Membuka ${item.ticker.replace(".JK", "")} pada ${formatDate(row.date)} dari List Table High Low.`);
    void loadTicker(item.ticker, item.name, row.date);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="rounded-[22px] border border-silver-200/10 bg-silver-100/[0.035] p-3 sm:rounded-[26px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">Candle Breakdown</p>
            <h3 className="mt-2 text-lg font-extrabold text-silver-100 sm:text-xl">Chart harian sederhana untuk catat high/low penting.</h3>
            <p className="mt-2 text-sm leading-relaxed text-silver-500">
              Cari saham, klik candle, lalu simpan high, low, dan close dari candle pilihan beserta 5 candle perdagangan sebelum dan sesudahnya.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-silver-200/10 bg-[oklch(10%_0.014_150_/_0.58)] px-4 py-3 text-sm text-silver-400 sm:w-auto sm:min-w-36">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-600">Tersimpan</p>
            <p className="mt-1 text-lg font-black text-silver-100">{saved.length}</p>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value.toUpperCase());
                searchStocks(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  openDirectTicker();
                }
              }}
              placeholder="Cari ticker, contoh: ANTM, GOTO, BRMS"
              className="glass-input w-full flex-1 px-4 py-3 text-sm text-silver-200"
            />
            <button
              type="button"
              onClick={openDirectTicker}
              disabled={loadingChart || !query.trim()}
              className="w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50 md:w-auto"
              style={{ background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.24)", color: "#fdba74" }}
            >
              {loadingChart ? "Memuat..." : "Buka Chart"}
            </button>
          </div>

          {(searching || results.length > 0) && (
            <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-silver-200/10 bg-[oklch(9%_0.016_150_/_0.98)] p-2 shadow-2xl">
              {searching ? <p className="px-3 py-2 text-sm text-silver-500">Mencari saham...</p> : null}
              {results.map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  onClick={() => {
                    setQuery(result.symbol.replace(".JK", ""));
                    void loadTicker(result.symbol, result.name);
                  }}
                  className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-silver-100/[0.05]"
                >
                  <p className="text-sm font-bold text-silver-100">{result.symbol.replace(".JK", "")}</p>
                  <p className="mt-0.5 truncate text-xs text-silver-500">{result.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] xl:gap-5">
        <div className="min-w-0 rounded-[22px] border border-silver-200/10 bg-silver-100/[0.025] p-3 sm:rounded-[26px] sm:p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-600">Chart</p>
              <h3 className="mt-1 flex flex-col text-lg font-extrabold text-silver-100 sm:block">
                {selectedTicker ? selectedTicker.replace(".JK", "") : "Pilih saham"}
                {selectedName && selectedTicker ? <span className="text-sm font-semibold text-silver-500 sm:ml-2">{selectedName}</span> : null}
              </h3>
            </div>
            {selectedCandle ? (
              <p className="text-xs text-silver-500">Candle dipilih: <span className="font-bold text-orange-300">{formatDate(selectedCandle.time)}</span></p>
            ) : null}
          </div>

          {loadingChart ? (
            <div className="flex h-[300px] items-center justify-center rounded-2xl bg-silver-100/[0.035] text-sm text-silver-500 sm:h-[350px] lg:h-[430px] lg:rounded-3xl">Memuat chart...</div>
          ) : history.length > 0 ? (
            <>
              {selectedCandle ? (
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-silver-200/10 bg-silver-100/[0.035] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-silver-600">Close</p>
                    <p className="mt-1 text-xl font-black text-silver-100 sm:text-2xl">{formatPrice(selectedCandle.close)}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/70">High</p>
                    <p className="mt-1 text-xl font-black text-emerald-300 sm:text-2xl">{formatPrice(selectedCandle.high)}</p>
                  </div>
                  <div className="rounded-2xl border border-red-300/15 bg-red-300/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/70">Low</p>
                    <p className="mt-1 text-xl font-black text-red-300 sm:text-2xl">{formatPrice(selectedCandle.low)}</p>
                  </div>
                </div>
              ) : null}
              <AdminBreakdownChart data={history} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
              {selectedCandle && (
                <div className="mt-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-silver-600">Intraday {formatDate(selectedCandle.time)}</p>
                  {intradayLoading ? (
                    <p className="text-xs text-silver-500">Memuat intraday...</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(["5m", "15m", "60m"] as const).map((tf) => (
                        <div key={tf} className="rounded-xl border border-silver-200/10 bg-silver-100/[0.025] p-2">
                          <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-silver-500">{tf === "60m" ? "1H" : tf.toUpperCase()}</p>
                          {intradayData[tf] && intradayData[tf].length > 0 ? (
                            <IntradayMiniChart data={intradayData[tf]} height={150} />
                          ) : (
                            <div className="flex h-[150px] items-center justify-center text-[10px] text-silver-600">Tidak ada data</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center rounded-2xl bg-silver-100/[0.035] px-6 text-center text-sm text-silver-500 sm:h-[350px] lg:h-[430px] lg:rounded-3xl">
              Cari saham untuk mulai breakdown candle.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-silver-200/10 bg-silver-100/[0.025] p-3 sm:rounded-[26px] sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-600">Tabel Candle</p>
                <h3 className="mt-1 text-lg font-extrabold text-silver-100">High / Low sekitar candle</h3>
              </div>
              <button
                type="button"
                onClick={addBreakdown}
                disabled={!selectedCandle || contextRows.length === 0}
                className="w-full rounded-xl px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                style={{ background: "rgba(16,185,129,0.16)", border: "1px solid rgba(16,185,129,0.28)", color: "#6ee7b7" }}
              >
                Add ke List
              </button>
            </div>

            {selectedCandle ? (
              <div className="mt-4 rounded-2xl border border-orange-200/15 bg-orange-100/10 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200/75">Candle dipilih</p>
                    <p className="mt-1 text-sm font-bold text-silver-100">{formatDate(selectedCandle.time)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/70">H</p>
                      <p className="text-sm font-black text-emerald-300">{formatPrice(selectedCandle.high)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-red-300/70">L</p>
                      <p className="text-sm font-black text-red-300">{formatPrice(selectedCandle.low)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-silver-600">Close</p>
                      <p className="text-sm font-black text-silver-100">{formatPrice(selectedCandle.close)}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-silver-500">
                  Menampilkan {contextRows.length} candle: {beforeCount} sebelum, 1 dipilih, {afterCount} sesudah. Jika candle dekat data terakhir, jumlah sesudah otomatis mengikuti data yang tersedia.
                </p>
              </div>
            ) : null}

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Keterangan opsional untuk candle ini..."
              className="mt-4 min-h-20 w-full rounded-2xl border border-silver-200/10 bg-[oklch(9%_0.014_150_/_0.55)] px-3 py-2 text-sm text-silver-200 outline-none placeholder:text-silver-600 focus:border-orange-300/35"
            />

            <button
              type="button"
              onClick={addBreakdown}
              disabled={!selectedCandle || contextRows.length === 0}
              className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.24), rgba(251,146,60,0.16))", border: "1px solid rgba(16,185,129,0.26)", color: "#d1fae5" }}
            >
              Add ke List Table High Low
            </button>

            {saveMessage ? <p className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-300">{saveMessage}</p> : null}

            <CandleRowCards rows={contextRows} />

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-silver-200/10 md:block">
              <table className="w-full table-fixed text-center text-[11px] text-silver-400">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[13%]" />
                  <col className="w-[21%]" />
                  <col className="w-[21%]" />
                  <col className="w-[21%]" />
                </colgroup>
                <thead className="bg-silver-100/[0.04] text-[9px] uppercase tracking-[0.08em] text-silver-600">
                  <tr>
                    <th className="px-1.5 py-2.5">Tanggal</th>
                    <th className="px-1.5 py-2.5">Posisi</th>
                    <th className="px-1.5 py-2.5">H</th>
                    <th className="px-1.5 py-2.5">L</th>
                    <th className="px-1.5 py-2.5">Close</th>
                  </tr>
                </thead>
                <tbody>
                  {contextRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-1.5 py-8 text-center text-silver-600">Klik candle di chart.</td></tr>
                  ) : contextRows.map((row) => (
                    <tr
                      key={`${row.date}-${row.index}`}
                      className="border-t border-silver-200/10"
                      style={{ background: row.selected ? "rgba(251,146,60,0.14)" : "transparent", outline: row.selected ? "2px solid rgba(251,146,60,0.45)" : "none" }}
                    >
                      <td className="px-1.5 py-2.5 font-semibold text-silver-200">{formatShortDate(row.date)}</td>
                      <td className="px-1.5 py-2.5">{formatPosition(row, contextRows)}</td>
                      <td className="px-1.5 py-2.5 text-emerald-300">{formatPrice(row.high)}</td>
                      <td className="px-1.5 py-2.5 text-red-300">{formatPrice(row.low)}</td>
                      <td className="px-1.5 py-2.5 text-silver-200">{formatPrice(row.close)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-silver-200/10 bg-silver-100/[0.025] p-3 sm:rounded-[26px] sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-600">List Table High Low</p>
            <h3 className="mt-1 text-lg font-extrabold text-silver-100">Breakdown tersimpan</h3>
          </div>
          {saved.length > 0 ? (
            <button type="button" onClick={() => setSaved([])} className="w-full rounded-xl border border-red-300/15 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 sm:w-auto">
              Bersihkan
            </button>
          ) : null}
        </div>

        {saved.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-silver-200/10 px-4 py-8 text-center text-sm text-silver-600">
            Belum ada breakdown yang ditambahkan.
          </div>
        ) : (
          <div className="space-y-4">
            {saved.map((item) => {
              const selected = item.rows.find((row) => row.selected);
              return (
                <div key={item.id} className="rounded-2xl border border-silver-200/10 bg-[oklch(9%_0.014_150_/_0.38)] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-col text-base font-black text-silver-100 sm:block">{item.ticker.replace(".JK", "")} <span className="text-sm font-semibold text-silver-500">{item.name}</span></p>
                      <p className="mt-1 text-xs text-silver-500">Candle: {formatShortDate(item.selectedDate)} | H {selected ? formatPrice(selected.high) : "-"} | L {selected ? formatPrice(selected.low) : "-"} | Close {selected ? formatPrice(selected.close) : "-"}</p>
                      {item.note ? <p className="mt-2 text-sm leading-relaxed text-silver-400">{item.note}</p> : null}
                    </div>
                    <button type="button" onClick={() => deleteBreakdown(item.id)} className="w-full rounded-xl border border-red-300/15 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/15 sm:w-auto">
                      Delete
                    </button>
                  </div>

                  <div className="mt-3 md:hidden">
                    <CandleRowCards rows={item.rows} onOpen={(row) => openSavedRow(item, row)} actionLabel="Chart" />
                  </div>

                  <div className="mt-3 hidden overflow-hidden rounded-xl border border-silver-200/10 md:block">
                    <table className="w-full table-fixed text-center text-[11px] text-silver-400">
                      <colgroup>
                        <col className="w-[20%]" />
                        <col className="w-[11%]" />
                        <col className="w-[19%]" />
                        <col className="w-[19%]" />
                        <col className="w-[19%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead className="bg-silver-100/[0.035] text-[9px] uppercase tracking-[0.08em] text-silver-600">
                        <tr>
                          <th className="px-1.5 py-2.5">Tanggal</th>
                          <th className="px-1.5 py-2.5">Posisi</th>
                          <th className="px-1.5 py-2.5">H</th>
                          <th className="px-1.5 py-2.5">L</th>
                          <th className="px-1.5 py-2.5">Close</th>
                          <th className="px-1.5 py-2.5">Chart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.rows.map((row) => (
                          <tr key={`${item.id}-${row.date}-${row.index}`} className="border-t border-silver-200/10" style={{ background: row.selected ? "rgba(251,146,60,0.12)" : "transparent" }}>
                            <td className="px-1.5 py-2.5">
                              <button
                                type="button"
                                onClick={() => openSavedRow(item, row)}
                                className="font-bold text-orange-200 underline-offset-4 hover:text-orange-100 hover:underline"
                                title="Buka candle ini di chart atas"
                              >
                                {formatShortDate(row.date)}
                              </button>
                            </td>
                            <td className="px-1.5 py-2.5">{formatPosition(row, item.rows)}</td>
                            <td className="px-1.5 py-2.5 text-emerald-300">{formatPrice(row.high)}</td>
                            <td className="px-1.5 py-2.5 text-red-300">{formatPrice(row.low)}</td>
                            <td className="px-1.5 py-2.5 text-silver-200">{formatPrice(row.close)}</td>
                            <td className="px-1.5 py-2.5">
                              <button
                                type="button"
                                onClick={() => openSavedRow(item, row)}
                                className="rounded-md border border-orange-200/15 bg-orange-100/10 px-1.5 py-1 text-[9px] font-bold text-orange-200"
                              >
                                Buka
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
