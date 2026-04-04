"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { OHLCData } from "@/lib/types";
import { inferTradeDateFromFilename } from "@/lib/xlsxWorkbook";

const StockSummaryAccumulationChart = dynamic(
  () => import("@/app/admin/StockSummaryAccumulationChart"),
  { ssr: false }
);

type StockSummaryRow = {
  id: string;
  tradeDate: string;
  stockCode: string;
  companyName: string | null;
  remarks: string | null;
  previous: number | null;
  openPrice: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change: number | null;
  volume: number | null;
  value: number | null;
  frequency: number | null;
  foreignSell: number | null;
  foreignBuy: number | null;
  source: string;
};

type StockAccumulationCandidate = {
  stockCode: string;
  companyName: string | null;
  close: number | null;
  change: number | null;
  volume: number | null;
  value: number | null;
  foreignBuy: number | null;
  foreignSell: number | null;
  bidVolume: number | null;
  offerVolume: number | null;
  accumulationScore: number;
  readinessScore: number;
  netForeign: number;
  closeToHighPercent: number | null;
  bidOfferRatio: number | null;
  convictionScore: number;
  convictionLabel: "Sangat Kuat" | "Kuat" | "Menarik" | "Awal";
  phase: "Akumulasi Kuat" | "Akumulasi Siap Jalan" | "Pantau";
  reasons: string[];
  summary: string;
  recentPositiveForeignDays: number;
  recentStrongCloseDays: number;
  recentLocalPressureDays: number;
  windowDays: number;
};

type StockSeriesPoint = {
  time: string;
  localAccumulation: number;
  foreignAccumulation: number;
  close: number | null;
  netForeign: number;
  localPressure: number;
};

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString("id-ID");
}

function getMessageTone(message: string) {
  return message.toLowerCase().includes("berhasil") ? "text-emerald-300" : "text-red-400";
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function getWeekStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return toIsoDate(date);
}

function buildWeekDates(value: string) {
  const start = getWeekStart(value);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function formatDateBadge(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString("id-ID", { weekday: "short" });
}

function buildWatchlistDraftFromAccumulation(item: StockAccumulationCandidate) {
  const note = [
    `${item.phase} | Conviction ${item.convictionScore}`,
    `Net foreign ${formatNumber(item.netForeign)}`,
    item.bidOfferRatio != null ? `Bid/offer ${item.bidOfferRatio}x` : "",
    item.summary,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ticker: item.stockCode,
    name: item.companyName || item.stockCode,
    tp: item.close && item.closeToHighPercent != null ? Math.round(item.close * 1.05) : null,
    sl: item.close && item.closeToHighPercent != null ? Math.round(item.close * 0.95) : null,
    note,
  };
}

export default function AdminStockSummaryPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [stockRows, setStockRows] = useState<StockSummaryRow[]>([]);
  const [stockRowsError, setStockRowsError] = useState("");
  const [stockQueryDate, setStockQueryDate] = useState(today);
  const [stockQuerySymbol, setStockQuerySymbol] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableDatesLoading, setAvailableDatesLoading] = useState(false);
  const [availableDatesMessage, setAvailableDatesMessage] = useState("");
  const [stockUploadDate, setStockUploadDate] = useState(today);
  const [stockUploadFile, setStockUploadFile] = useState<File | null>(null);
  const [stockUploadLoading, setStockUploadLoading] = useState(false);
  const [stockUploadMessage, setStockUploadMessage] = useState("");
  const [stockUploadInputKey, setStockUploadInputKey] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [accumulationRows, setAccumulationRows] = useState<StockAccumulationCandidate[]>([]);
  const [accumulationLookbackDays, setAccumulationLookbackDays] = useState(1);
  const [accumulationLoading, setAccumulationLoading] = useState(false);
  const [accumulationError, setAccumulationError] = useState("");
  const [dateSelectionLoading, setDateSelectionLoading] = useState(false);
  const [dateSelectionMessage, setDateSelectionMessage] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [chartPriceData, setChartPriceData] = useState<OHLCData[]>([]);
  const [chartFlowData, setChartFlowData] = useState<StockSeriesPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const lookbackLabel = `${accumulationLookbackDays} hari trading terakhir`;
  const requestedTicker = useMemo(() => searchParams.get("ticker") || "", [searchParams]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  const weekDates = useMemo(() => buildWeekDates(stockQueryDate), [stockQueryDate]);
  const latestAvailableDate = availableDates[0] || "";

  const loadAvailableDates = async (preferredDate?: string) => {
    try {
      setAvailableDatesLoading(true);
      setAvailableDatesMessage("");
      const res = await fetch("/api/admin/stock-summary?view=dates&limit=42", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat daftar tanggal stock summary");

      const nextDates = Array.isArray(data.dates) ? data.dates : [];
      setAvailableDates(nextDates);

      const nextLatest = typeof data.latestDate === "string" ? data.latestDate : nextDates[0] || "";
      const targetDate = preferredDate || stockQueryDate;
      if (nextDates.length === 0) {
        setAvailableDatesMessage("Belum ada data stock summary yang tersimpan. Upload file IDX terlebih dahulu.");
        return;
      }

      if (!nextDates.includes(targetDate) && nextLatest) {
        setAvailableDatesMessage(`Data untuk ${formatDateBadge(targetDate)} belum tersedia. Menampilkan tanggal terakhir yang ada: ${formatDateBadge(nextLatest)}.`);
        setStockQueryDate(nextLatest);
      }
    } catch (err) {
      setAvailableDates([]);
      setAvailableDatesMessage(err instanceof Error ? err.message : "Gagal memuat daftar tanggal stock summary");
    } finally {
      setAvailableDatesLoading(false);
    }
  };

  const loadStockRows = async () => {
    try {
      setStockRowsError("");
      const qs = new URLSearchParams({ date: stockQueryDate });
      if (stockQuerySymbol.trim()) qs.set("symbol", stockQuerySymbol.trim().toUpperCase());
      const res = await fetch(`/api/admin/stock-summary?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat stock summary");
      setStockRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setStockRowsError(err instanceof Error ? err.message : "Gagal memuat stock summary");
      setStockRows([]);
    }
  };

  const loadAccumulationRows = async () => {
    try {
      setAccumulationLoading(true);
      setAccumulationError("");
      const qs = new URLSearchParams({ date: stockQueryDate, limit: "12" });
      const res = await fetch(`/api/admin/stock-summary/analysis?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat analisa akumulasi");
      const nextRows: StockAccumulationCandidate[] = Array.isArray(data.data) ? data.data : [];
      setAccumulationRows(nextRows);
      setAccumulationLookbackDays(typeof data.lookbackDays === "number" ? data.lookbackDays : 1);
      if (nextRows[0]?.stockCode) {
        setSelectedTicker((current) => (current && nextRows.some((row) => row.stockCode === current) ? current : nextRows[0].stockCode));
      } else {
        setSelectedTicker("");
      }
    } catch (err) {
      setAccumulationError(err instanceof Error ? err.message : "Gagal memuat analisa akumulasi");
      setAccumulationRows([]);
      setAccumulationLookbackDays(1);
      setSelectedTicker("");
    } finally {
      setAccumulationLoading(false);
    }
  };

  const loadChart = async (ticker: string) => {
    if (!ticker.trim()) {
      setChartError("Pilih ticker terlebih dahulu.");
      setChartPriceData([]);
      setChartFlowData([]);
      return;
    }

    try {
      setChartLoading(true);
      setChartError("");
      const normalizedTicker = ticker.toUpperCase().replace(/\.JK$/i, "").trim();
      const [priceRes, flowRes] = await Promise.all([
        fetch(`/api/stocks/history/${normalizedTicker}.JK?range=6mo&interval=1d`, { cache: "no-store" }),
        fetch(`/api/admin/stock-summary/series?ticker=${normalizedTicker}&days=120`, { cache: "no-store" }),
      ]);
      const [priceData, flowData] = await Promise.all([priceRes.json(), flowRes.json()]);
      if (!priceRes.ok) throw new Error(priceData.error || "Gagal memuat history harga");
      if (!flowRes.ok) throw new Error(flowData.error || "Gagal memuat series akumulasi");
      setChartPriceData(Array.isArray(priceData) ? priceData : []);
      setChartFlowData(Array.isArray(flowData.data) ? flowData.data : []);
    } catch (err) {
      setChartError(err instanceof Error ? err.message : "Gagal memuat chart akumulasi");
      setChartPriceData([]);
      setChartFlowData([]);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailableDates(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDateSelectionLoading(true);
    setDateSelectionMessage(`Memuat screening untuk ${formatDateBadge(stockQueryDate)}...`);
    void loadStockRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQueryDate]);

  useEffect(() => {
    void loadAccumulationRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQueryDate]);

  useEffect(() => {
    if (accumulationLoading) return;
    const hasErrors = Boolean(stockRowsError || accumulationError);
    if (hasErrors) {
      setDateSelectionLoading(false);
      setDateSelectionMessage("Gagal memuat hasil untuk tanggal ini.");
      return;
    }

    const hasDataForDate = availableDateSet.has(stockQueryDate);
    if (!hasDataForDate) {
      setDateSelectionLoading(false);
      setDateSelectionMessage(`Belum ada data IDX untuk ${formatDateBadge(stockQueryDate)}.`);
      return;
    }

    if (stockRows.length > 0 || accumulationRows.length > 0) {
      setDateSelectionLoading(false);
      setDateSelectionMessage(`Menampilkan hasil screening untuk ${formatDateBadge(stockQueryDate)}.`);
    }
  }, [stockQueryDate, stockRows.length, accumulationRows.length, stockRowsError, accumulationError, accumulationLoading, availableDateSet]);

  useEffect(() => {
    if (!selectedTicker) {
      setChartPriceData([]);
      setChartFlowData([]);
      setChartError("");
      return;
    }
    void loadChart(selectedTicker);
  }, [selectedTicker]);

  useEffect(() => {
    if (!requestedTicker) return;
    setSelectedTicker(requestedTicker.toUpperCase().replace(/\.JK$/i, ""));
  }, [requestedTicker]);

  const submitStockUploadImport = async () => {
    if (!stockUploadFile) {
      setStockUploadMessage("Pilih file IDX terlebih dahulu.");
      return;
    }

    try {
      setStockUploadLoading(true);
      setStockUploadMessage("");
      const formData = new FormData();
      formData.set("file", stockUploadFile);
      formData.set("tradeDate", stockUploadDate);
      const res = await fetch("/api/admin/stock-summary", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload stock summary");
      setStockUploadMessage(`Upload berhasil: ${data.rowCount ?? data.parsedRows ?? 0} row.`);
      setStockUploadFile(null);
      setStockUploadInputKey((value) => value + 1);
      setStockQueryDate(stockUploadDate);
      await loadAvailableDates(stockUploadDate);
      await loadStockRows();
      await loadAccumulationRows();
    } catch (err) {
      setStockUploadMessage(err instanceof Error ? err.message : "Gagal upload stock summary");
    } finally {
      setStockUploadLoading(false);
    }
  };

  const handleStockUploadFileChange = (file: File | null) => {
    setStockUploadFile(file);
    if (!file) return;

    const inferredDate = inferTradeDateFromFilename(file.name);
    if (inferredDate) {
      setStockUploadDate(inferredDate);
    }
  };

  const deleteStockSummaryByDate = async () => {
    const confirmed = window.confirm(`Hapus semua data Stock Summary untuk tanggal ${stockQueryDate}?`);
    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      setDeleteMessage("");
      const res = await fetch(`/api/admin/stock-summary?scope=date&date=${stockQueryDate}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus stock summary per tanggal");
      setDeleteMessage(`Berhasil menghapus ${data.deletedCount ?? 0} row untuk tanggal ${stockQueryDate}.`);
      setStockRows([]);
      setAccumulationRows([]);
      setChartPriceData([]);
      setChartFlowData([]);
      setSelectedTicker("");
      await loadAvailableDates();
      await loadStockRows();
      await loadAccumulationRows();
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : "Gagal menghapus stock summary per tanggal");
    } finally {
      setDeleteLoading(false);
    }
  };

  const deleteAllStockSummary = async () => {
    const confirmed = window.confirm("Hapus SEMUA data Stock Summary di database? Tindakan ini tidak bisa dibatalkan.");
    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      setDeleteMessage("");
      const res = await fetch("/api/admin/stock-summary?scope=all", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus semua stock summary");
      setDeleteMessage(`Berhasil menghapus ${data.deletedCount ?? 0} row Stock Summary dari database.`);
      setStockRows([]);
      setAccumulationRows([]);
      setChartPriceData([]);
      setChartFlowData([]);
      setSelectedTicker("");
      setAvailableDates([]);
      setAvailableDatesMessage("Belum ada data stock summary yang tersimpan. Upload file IDX terlebih dahulu.");
    } catch (err) {
      setDeleteMessage(err instanceof Error ? err.message : "Gagal menghapus semua stock summary");
    } finally {
      setDeleteLoading(false);
    }
  };

  const localLine = chartFlowData.map((point) => ({ time: point.time, value: point.localAccumulation }));
  const foreignLine = chartFlowData.map((point) => ({ time: point.time, value: point.foreignAccumulation }));
  const previousAvailableDate = availableDates.find((date) => date < stockQueryDate) || "";

  const openBandarmologyFlow = (ticker: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "bandarmology");
    params.set("ticker", ticker.replace(/\.JK$/i, ""));
    router.replace(`/admin?${params.toString()}`);
  };

  const openWatchlistDraft = (draft: { ticker: string; name: string; tp: number | null; sl: number | null; note: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "watchlist");
    params.set("prefillTicker", draft.ticker.replace(/\.JK$/i, ""));
    params.set("prefillName", draft.name);
    if (draft.tp != null) params.set("prefillTp", String(draft.tp));
    else params.delete("prefillTp");
    if (draft.sl != null) params.set("prefillSl", String(draft.sl));
    else params.delete("prefillSl");
    params.set("prefillNote", draft.note);
    router.replace(`/admin?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-silver-100">Stock Summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-silver-400">
              Upload file IDX, pilih tanggal langsung dari kalender mingguan, lalu screen kandidat akumulasi tanpa perlu menunggu data hari ini tersedia.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-silver-300">
            <p className="text-[11px] uppercase tracking-[0.22em] text-silver-500">Tanggal Aktif</p>
            <p className="mt-1 font-semibold text-silver-100">{formatDateBadge(stockQueryDate)}</p>
            <p className="mt-1 text-xs text-silver-500">
              {latestAvailableDate ? `Data terbaru: ${formatDateBadge(latestAvailableDate)}` : "Belum ada histori tersimpan"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-base font-bold text-silver-100">Kalender Screening Mingguan</h3>
            <p className="mt-2 text-sm leading-relaxed text-silver-400">
              Klik tanggal untuk langsung membuka screen hari itu. Hari dengan titik hijau berarti data sudah tersedia di database.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStockQueryDate((current) => addDays(current, -7))}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}
            >
              Minggu Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setStockQueryDate((current) => addDays(current, 7))}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}
            >
              Minggu Berikutnya
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {weekDates.map((date) => {
            const isActive = date === stockQueryDate;
            const isAvailable = availableDateSet.has(date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setStockQueryDate(date);
                  setDateSelectionLoading(true);
                  setDateSelectionMessage(`Memuat screening untuk ${formatDateBadge(date)}...`);
                }}
                className="rounded-2xl p-3 text-left transition-all"
                style={{
                  background: isActive ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                  border: isActive ? "1px solid rgba(16,185,129,0.26)" : "1px solid rgba(226,232,240,0.06)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-silver-500">{formatDayLabel(date)}</p>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: isAvailable ? "#34d399" : "rgba(148,163,184,0.35)" }}
                  />
                </div>
                <p className="mt-2 text-lg font-semibold text-silver-100">{date.slice(-2)}</p>
                <p className="mt-1 text-xs text-silver-500">{date.slice(5, 7)}</p>
              </button>
            );
          })}
        </div>

        {availableDatesLoading ? <p className="text-sm text-silver-500">Memuat kalender data...</p> : null}
        {availableDatesMessage ? <p className="text-sm text-amber-300">{availableDatesMessage}</p> : null}
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-silver-500">Status Screening</p>
              <p className={`mt-1 text-sm ${dateSelectionLoading ? "text-sky-300" : "text-silver-300"}`}>{dateSelectionMessage}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {previousAvailableDate ? (
                <button
                  type="button"
                  onClick={() => setStockQueryDate(previousAvailableDate)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}
                >
                  Cek Tanggal Sebelumnya
                </button>
              ) : null}
              {latestAvailableDate ? (
                <button
                  type="button"
                  onClick={() => setStockQueryDate(latestAvailableDate)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
                >
                  Gunakan Tanggal Terbaru
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-silver-100">Chart Harga dan Akumulasi</h3>
            <p className="mt-2 text-sm text-silver-400">
              Candlestick harga dari Yahoo Finance digabung dengan line `Akumulasi Lokal` dan `Akumulasi Foreign` dari histori Stock Summary.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row w-full xl:w-auto">
            <input
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
              placeholder="Ticker"
              className="glass-input px-4 py-3 text-sm text-silver-200"
            />
            <button
              type="button"
              onClick={() => loadChart(selectedTicker)}
              className="rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}
            >
              Load Chart
            </button>
          </div>
        </div>

        {selectedTicker ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openBandarmologyFlow(selectedTicker)}
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.18)" }}
            >
              Buka Bandarmology
            </button>
            <button
              type="button"
              onClick={() => openWatchlistDraft({
                ticker: selectedTicker,
                name: selectedTicker,
                tp: null,
                sl: null,
                note: `Monitoring flow stock summary untuk ${selectedTicker.toUpperCase()}`,
              })}
              className="rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              Draft Watchlist
            </button>
          </div>
        ) : null}

        {chartError ? <p className="text-sm text-red-400">{chartError}</p> : null}

        {chartLoading ? (
          <div className="h-80 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ) : chartPriceData.length > 0 && chartFlowData.length > 0 ? (
          <StockSummaryAccumulationChart priceData={chartPriceData} localFlow={localLine} foreignFlow={foreignLine} />
        ) : (
          <div className="rounded-2xl p-6 text-center text-sm text-silver-500" style={{ background: "rgba(255,255,255,0.04)" }}>
            Belum ada data chart untuk ticker ini.
          </div>
        )}
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h3 className="text-base font-bold text-silver-100">Analisa Akumulasi dan Mau Jalan</h3>
            <p className="mt-2 text-sm leading-relaxed text-silver-400">
              Shortlist ini memakai hari aktif sebagai anchor utama, lalu mengecek konsistensi jejak serap, foreign flow, tekanan lokal, dan kualitas close selama {lookbackLabel}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadAvailableDates(stockQueryDate);
              void loadAccumulationRows();
            }}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
          >
            Muat Ulang Analisa
          </button>
        </div>

        {accumulationError ? <p className="text-sm text-red-400">{accumulationError}</p> : null}

        {accumulationLoading ? (
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ) : accumulationRows.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {accumulationRows.map((item) => (
              <button
                key={item.stockCode}
                type="button"
                onClick={() => setSelectedTicker(item.stockCode)}
                className="rounded-2xl p-4 space-y-4 text-left transition-all"
                style={{
                  background: selectedTicker === item.stockCode ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                  border: selectedTicker === item.stockCode ? "1px solid rgba(59,130,246,0.24)" : "1px solid rgba(226,232,240,0.08)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-silver-100">{item.stockCode}</p>
                    <p className="mt-1 text-sm text-silver-400">{item.companyName || "-"}</p>
                  </div>
                  <div className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "rgba(59,130,246,0.14)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.24)" }}>
                    Conviction {item.convictionScore}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-silver-500">Close</p>
                    <p className="mt-1 font-semibold text-silver-100">{formatNumber(item.close)}</p>
                  </div>
                  <div>
                    <p className="text-silver-500">Net Foreign</p>
                    <p className={`mt-1 font-semibold ${item.netForeign >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatNumber(item.netForeign)}</p>
                  </div>
                  <div>
                    <p className="text-silver-500">Bid/Offer</p>
                    <p className="mt-1 text-silver-100">{item.bidOfferRatio == null ? "-" : `${item.bidOfferRatio}x`}</p>
                  </div>
                  <div>
                    <p className="text-silver-500">Close ke High</p>
                    <p className="mt-1 text-silver-100">{item.closeToHighPercent == null ? "-" : `${item.closeToHighPercent}%`}</p>
                  </div>
                  <div>
                    <p className="text-silver-500">Flow Konsisten</p>
                    <p className="mt-1 text-silver-100">{item.recentPositiveForeignDays}/{item.windowDays} hari</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-silver-400">{item.summary}</p>

                <div className="flex flex-wrap gap-2">
                  {item.reasons.map((reason) => (
                    <span
                      key={`${item.stockCode}-${reason}`}
                      className="rounded-full px-2.5 py-1 text-xs"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.06)" }}
                    >
                      {reason}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openBandarmologyFlow(item.stockCode);
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.18)" }}
                  >
                    Lanjut ke Bandarmology
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openWatchlistDraft(buildWatchlistDraftFromAccumulation(item));
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
                  >
                    Buat Draft Watchlist
                  </button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center text-sm text-silver-500" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p>Belum ada kandidat kuat untuk {formatDateBadge(stockQueryDate)}.</p>
            <p className="mt-2">Pilih tanggal lain dari kalender mingguan atau lompat ke tanggal tersedia terdekat.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {previousAvailableDate ? (
                <button
                  type="button"
                  onClick={() => setStockQueryDate(previousAvailableDate)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.08)" }}
                >
                  Buka Tanggal Sebelumnya
                </button>
              ) : null}
              {latestAvailableDate ? (
                <button
                  type="button"
                  onClick={() => setStockQueryDate(latestAvailableDate)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
                >
                  Gunakan Tanggal Terbaru
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}
              >
                Upload File IDX
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <h3 className="text-base font-bold text-silver-100">Upload File IDX</h3>
            <p className="mt-2 text-sm leading-relaxed text-silver-400">
              Upload file `Stock Summary` atau `Ringkasan Saham` langsung dari IDX. Nama file seperti `Stock Summary-20260331.xlsx` atau `Ringkasan Saham-20260402.xlsx` membantu sistem membaca tanggal otomatis dan langsung mengarahkan screening ke hari tersebut.
            </p>
          </div>
          <input type="date" value={stockUploadDate} onChange={(e) => setStockUploadDate(e.target.value)} className="glass-input w-full px-4 py-3 text-sm text-silver-200" />
          <input
            key={stockUploadInputKey}
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt"
            onChange={(e) => handleStockUploadFileChange(e.target.files?.[0] || null)}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <p className="text-xs text-silver-500">
            File terpilih: {stockUploadFile?.name || "Belum ada"}
            {stockUploadFile ? ` | tanggal data: ${stockUploadDate}` : ""}
          </p>
          <button
            type="button"
            onClick={() => submitStockUploadImport()}
            disabled={stockUploadLoading}
            className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff" }}
          >
            {stockUploadLoading ? "Uploading..." : "Upload Stock Summary"}
          </button>
          {stockUploadMessage ? <p className={`text-sm ${getMessageTone(stockUploadMessage)}`}>{stockUploadMessage}</p> : null}
        </div>

        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <h3 className="text-base font-bold text-silver-100">Browser dan Hapus Data</h3>
            <p className="mt-2 text-sm leading-relaxed text-silver-400">
              Lihat data harian yang sudah tersimpan di database, filter per ticker bila perlu, lalu hapus tanggal aktif atau bersihkan seluruh data.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-silver-500">Tanggal yang sedang dibrowse</p>
            <p className="mt-1 text-base font-semibold text-silver-100">{formatDateBadge(stockQueryDate)}</p>
          </div>
          <input value={stockQuerySymbol} onChange={(e) => setStockQuerySymbol(e.target.value.toUpperCase())} placeholder="Stock code" className="glass-input w-full px-4 py-3 text-sm text-silver-200" />
          <button
            type="button"
            onClick={() => loadStockRows()}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
          >
            Muat Data Tanggal Ini
          </button>
          <button
            type="button"
            onClick={() => deleteStockSummaryByDate()}
            disabled={deleteLoading}
            className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            {deleteLoading ? "Memproses..." : `Hapus Tanggal ${stockQueryDate}`}
          </button>
          <button
            type="button"
            onClick={() => deleteAllStockSummary()}
            disabled={deleteLoading}
            className="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#7f1d1d,#ef4444)", color: "#fff" }}
          >
            {deleteLoading ? "Memproses..." : "Hapus Semua Data"}
          </button>
          {stockRowsError ? <p className="text-sm text-red-400">{stockRowsError}</p> : null}
          {deleteMessage ? <p className={`text-sm ${getMessageTone(deleteMessage)}`}>{deleteMessage}</p> : null}
          <p className="text-xs text-silver-500">Row tersimpan untuk tanggal aktif: {formatNumber(stockRows.length)}</p>
        </div>
      </div>
    </div>
  );
}

