"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { OHLCData } from "@/lib/types";
import { inferTradeDateFromFilename } from "@/lib/xlsxFilename";

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
  bandarmologyPhase: string | null;
  bandarmologyTone: "bullish" | "neutral" | "bearish" | "warning" | null;
  bandarmologyAlignment: "selaras" | "campuran" | "bertabrakan" | "tidak_tersedia";
  bandarmologyNote: string | null;
  // Technical fields
  atr14: number | null;
  rvol: number | null;
  mfi14: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  macdRising: boolean;
  bbSqueeze: boolean;
  bbWidthPercent: number | null;
  setups: string[];
  tradePlan: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskRewardRatio: number;
    riskRewardRatio2: number;
    riskPercent: number;
    reward1Percent: number;
    reward2Percent: number;
    basis: string;
  } | null;
  technicalScore: number;
  changePercent: number | null;
  pumpExhaustion: boolean;
  riskWarnings: string[];
};

type LiveStatus = "setup_valid" | "near_sl" | "sl_hit" | "tp1_reached" | "tp2_reached" | "above_entry" | "better_entry" | "no_plan";

type LiveStatusResult = {
  ticker: string;
  currentPrice: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  status: LiveStatus;
  recommendation: string;
  pricedSinceEntry: number | null;
  distanceToSL: number | null;
  distanceToTP1: number | null;
  intradayLowHitSL: boolean;
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
  const setupPart = item.setups.length > 0 ? `Setup: ${item.setups.join(", ")}` : "";
  const rrPart = item.tradePlan
    ? `R/R 1:${item.tradePlan.riskRewardRatio.toFixed(2)} (TP1) / 1:${item.tradePlan.riskRewardRatio2.toFixed(2)} (TP2)`
    : "";
  const note = [
    `${item.phase} | Conviction ${item.convictionScore} | Tech ${item.technicalScore}`,
    `Net foreign ${formatNumber(item.netForeign)}`,
    item.bidOfferRatio != null ? `Bid/offer ${item.bidOfferRatio}x` : "",
    item.rvol != null ? `RVOL ${item.rvol.toFixed(2)}x` : "",
    setupPart,
    rrPart,
    item.summary,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ticker: item.stockCode,
    name: item.companyName || item.stockCode,
    tp: item.tradePlan?.takeProfit1 ?? (item.close ? Math.round(item.close * 1.05) : null),
    sl: item.tradePlan?.stopLoss ?? (item.close ? Math.round(item.close * 0.95) : null),
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
  const [minRiskReward, setMinRiskReward] = useState<number>(0);
  const [liveStatusMap, setLiveStatusMap] = useState<Record<string, LiveStatusResult>>({});
  const [liveStatusLoading, setLiveStatusLoading] = useState(false);
  const [liveStatusFetchedAt, setLiveStatusFetchedAt] = useState<string>("");
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
      if (minRiskReward > 0) {
        qs.set("minRR", String(minRiskReward));
      }
      const res = await fetch(`/api/admin/stock-summary/analysis?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat analisa akumulasi");
      const nextRows: StockAccumulationCandidate[] = Array.isArray(data.data) ? data.data : [];
      setAccumulationRows(nextRows);
      setAccumulationLookbackDays(typeof data.lookbackDays === "number" ? data.lookbackDays : 1);
      if (nextRows[0]?.stockCode) {
        setSelectedTicker((current) => current || nextRows[0].stockCode);
      } else {
        setSelectedTicker((current) => current);
      }
    } catch (err) {
      setAccumulationError(err instanceof Error ? err.message : "Gagal memuat analisa akumulasi");
      setAccumulationRows([]);
      setAccumulationLookbackDays(1);
    } finally {
      setAccumulationLoading(false);
    }
  };

  const fetchLiveStatus = async (rows: StockAccumulationCandidate[]) => {
    if (rows.length === 0) {
      setLiveStatusMap({});
      return;
    }
    try {
      setLiveStatusLoading(true);
      const payload = {
        tickers: rows.map((row) => ({
          ticker: row.stockCode,
          tradePlan: row.tradePlan
            ? {
                entry: row.tradePlan.entry,
                stopLoss: row.tradePlan.stopLoss,
                takeProfit1: row.tradePlan.takeProfit1,
                takeProfit2: row.tradePlan.takeProfit2,
              }
            : null,
        })),
      };
      const res = await fetch("/api/admin/stock-summary/live-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data.data)) {
        const next: Record<string, LiveStatusResult> = {};
        for (const item of data.data as LiveStatusResult[]) {
          next[item.ticker] = item;
        }
        setLiveStatusMap(next);
        setLiveStatusFetchedAt(typeof data.fetchedAt === "string" ? data.fetchedAt : new Date().toISOString());
      }
    } catch {
      console.error("Failed to fetch live status");
    } finally {
      setLiveStatusLoading(false);
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
    if (accumulationRows.length > 0) {
      void fetchLiveStatus(accumulationRows);
    } else {
      setLiveStatusMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accumulationRows]);

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
              Shortlist ini memakai hari aktif sebagai anchor utama, lalu mengecek konsistensi jejak serap, foreign flow, tekanan lokal, kualitas close, dan keselarasan bandarmology selama {lookbackLabel} untuk menonjolkan kandidat yang mulai siap jalan.
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

        {/* R/R minimum filter */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.05)" }}>
          <span className="text-xs font-semibold text-silver-300">Filter R/R minimum:</span>
          {[0, 1.5, 2, 2.5, 3].map((rr) => (
            <button
              key={`rr-${rr}`}
              type="button"
              onClick={() => {
                setMinRiskReward(rr);
                void loadAccumulationRows();
              }}
              className="rounded-lg px-2.5 py-1 text-xs font-bold"
              style={{
                background: minRiskReward === rr ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.04)",
                color: minRiskReward === rr ? "#fb923c" : "#cbd5e1",
                border: minRiskReward === rr ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(226,232,240,0.06)",
              }}
            >
              {rr === 0 ? "Off" : `1:${rr}`}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-silver-500">
            {minRiskReward > 0
              ? `Hanya kandidat dengan R/R minimal 1:${minRiskReward}`
              : "Filter R/R nonaktif"}
          </span>
          <button
            type="button"
            onClick={() => void fetchLiveStatus(accumulationRows)}
            disabled={liveStatusLoading || accumulationRows.length === 0}
            className="rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50"
            style={{ background: "rgba(59,130,246,0.14)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.24)" }}
          >
            {liveStatusLoading ? "Memuat live…" : `🔄 Refresh Live${liveStatusFetchedAt ? ` (${new Date(liveStatusFetchedAt).toLocaleTimeString("id-ID")})` : ""}`}
          </button>
        </div>

        {accumulationError ? <p className="text-sm text-red-400">{accumulationError}</p> : null}

        {accumulationLoading ? (
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ) : accumulationRows.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {accumulationRows.map((item) => (
              <div
                key={item.stockCode}
                onClick={() => setSelectedTicker(item.stockCode)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTicker(item.stockCode);
                  }
                }}
                role="button"
                tabIndex={0}
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

                {/* Risk warnings (pump exhaustion, ATR caution) */}
                {item.riskWarnings.length > 0 ? (
                  <div className="rounded-2xl p-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-red-300">⚠ Peringatan Risiko</p>
                      {item.pumpExhaustion && item.changePercent != null ? (
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }}>
                          PUMP +{item.changePercent.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-1 text-xs leading-relaxed text-silver-300">
                      {item.riskWarnings.map((warn) => (
                        <li key={`${item.stockCode}-warn-${warn.slice(0, 20)}`}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Trade Plan: Entry / SL / TP1 / TP2 / R:R */}
                {item.tradePlan ? (
                  <div className="rounded-2xl p-3" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Trade Plan (1-3 hari)</p>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: item.tradePlan.riskRewardRatio >= 2 ? "#6ee7b7" : item.tradePlan.riskRewardRatio >= 1.5 ? "#fcd34d" : "#fca5a5",
                        }}
                      >
                        R/R 1:{item.tradePlan.riskRewardRatio.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-silver-500">Entry</p>
                        <p className="font-bold text-silver-100">{formatNumber(item.tradePlan.entry)}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Stop Loss</p>
                        <p className="font-bold text-red-300">
                          {formatNumber(item.tradePlan.stopLoss)}
                          <span className="ml-1 text-[10px] text-silver-500">(-{item.tradePlan.riskPercent.toFixed(1)}%)</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-silver-500">TP1</p>
                        <p className="font-bold text-emerald-300">
                          {formatNumber(item.tradePlan.takeProfit1)}
                          <span className="ml-1 text-[10px] text-silver-500">(+{item.tradePlan.reward1Percent.toFixed(1)}%)</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-silver-500">TP2</p>
                        <p className="font-bold text-emerald-300">
                          {formatNumber(item.tradePlan.takeProfit2)}
                          <span className="ml-1 text-[10px] text-silver-500">(+{item.tradePlan.reward2Percent.toFixed(1)}%)</span>
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-silver-500">{item.tradePlan.basis}. R/R TP2 = 1:{item.tradePlan.riskRewardRatio2.toFixed(2)}</p>
                  </div>
                ) : null}

                {/* Live Status (real-time vs trade plan) */}
                {(() => {
                  const live = liveStatusMap[item.stockCode];
                  if (!live || live.currentPrice == null) {
                    return liveStatusLoading ? (
                      <div className="rounded-2xl p-3 text-xs text-silver-400" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                        Memuat live status…
                      </div>
                    ) : null;
                  }

                  const statusColor: Record<LiveStatus, { bg: string; border: string; color: string; emoji: string; label: string }> = {
                    sl_hit: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.32)", color: "#fca5a5", emoji: "🔴", label: "SL HIT — SKIP" },
                    near_sl: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.24)", color: "#fca5a5", emoji: "🟠", label: "DEKAT SL — RISIKO" },
                    above_entry: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)", color: "#fcd34d", emoji: "🟡", label: "SUDAH NAIK — TUNGGU PULLBACK" },
                    setup_valid: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.28)", color: "#6ee7b7", emoji: "🟢", label: "SETUP MASIH VALID" },
                    better_entry: { bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.34)", color: "#6ee7b7", emoji: "🟢", label: "ENTRY LEBIH BAIK DARI AWAL" },
                    tp1_reached: { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.28)", color: "#93c5fd", emoji: "🔵", label: "TP1 TERSENTUH" },
                    tp2_reached: { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.28)", color: "#a5b4fc", emoji: "🟣", label: "TP2 TERSENTUH" },
                    no_plan: { bg: "rgba(255,255,255,0.03)", border: "rgba(226,232,240,0.06)", color: "#cbd5e1", emoji: "⚪", label: "TANPA TRADE PLAN" },
                  };
                  const c = statusColor[live.status];

                  return (
                    <div className="rounded-2xl p-3" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{c.emoji}</span>
                          <p className="text-[11px] uppercase tracking-[0.16em] font-bold" style={{ color: c.color }}>
                            Live: {c.label}
                          </p>
                        </div>
                        <span className="text-[10px] text-silver-500">{liveStatusFetchedAt ? new Date(liveStatusFetchedAt).toLocaleTimeString("id-ID") : ""}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-silver-500">Now</p>
                          <p className="font-bold text-silver-100">
                            {formatNumber(live.currentPrice)}
                            {live.changePercent != null ? (
                              <span className={`ml-1 text-[10px] ${live.changePercent >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                ({live.changePercent >= 0 ? "+" : ""}{live.changePercent.toFixed(2)}%)
                              </span>
                            ) : null}
                          </p>
                        </div>
                        {live.pricedSinceEntry != null ? (
                          <div>
                            <p className="text-silver-500">vs Entry</p>
                            <p className={`font-bold ${live.pricedSinceEntry >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                              {live.pricedSinceEntry >= 0 ? "+" : ""}{live.pricedSinceEntry.toFixed(2)}%
                            </p>
                          </div>
                        ) : null}
                        {live.distanceToSL != null ? (
                          <div>
                            <p className="text-silver-500">→ SL</p>
                            <p className="font-bold text-red-300">{live.distanceToSL.toFixed(2)}%</p>
                          </div>
                        ) : null}
                        {live.distanceToTP1 != null ? (
                          <div>
                            <p className="text-silver-500">→ TP1</p>
                            <p className="font-bold text-emerald-300">{live.distanceToTP1.toFixed(2)}%</p>
                          </div>
                        ) : null}
                      </div>

                      {live.intradayLowHitSL ? (
                        <p className="mt-2 text-[11px] font-semibold text-red-300">
                          ⚠ Low intraday {live.low ? formatNumber(live.low) : "?"} sudah menyentuh SL — setup invalid meski close di atasnya.
                        </p>
                      ) : null}

                      <p className="mt-2 text-xs leading-relaxed" style={{ color: c.color }}>{live.recommendation}</p>
                    </div>
                  );
                })()}

                {/* Setup tags + key indicators */}
                {item.setups.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.setups.map((setup) => (
                      <span
                        key={`${item.stockCode}-setup-${setup}`}
                        className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: "rgba(249,115,22,0.14)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.24)" }}
                      >
                        {setup}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Indicator strip */}
                {(item.atr14 != null || item.rvol != null || item.mfi14 != null || item.macdHistogram != null) ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    {item.atr14 != null ? (
                      <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                        <p className="text-silver-500">ATR(14)</p>
                        <p className="font-semibold text-silver-100">{item.atr14.toFixed(2)}</p>
                      </div>
                    ) : null}
                    {item.rvol != null ? (
                      <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                        <p className="text-silver-500">RVOL</p>
                        <p className={`font-semibold ${item.rvol >= 2 ? "text-emerald-300" : "text-silver-100"}`}>{item.rvol.toFixed(2)}x</p>
                      </div>
                    ) : null}
                    {item.mfi14 != null ? (
                      <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                        <p className="text-silver-500">MFI(14)</p>
                        <p className={`font-semibold ${item.mfi14 >= 80 ? "text-amber-300" : item.mfi14 >= 60 ? "text-emerald-300" : "text-silver-100"}`}>{item.mfi14.toFixed(0)}</p>
                      </div>
                    ) : null}
                    {item.macdHistogram != null ? (
                      <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
                        <p className="text-silver-500">MACD H</p>
                        <p className={`font-semibold ${item.macdHistogram > 0 && item.macdRising ? "text-emerald-300" : item.macdHistogram > 0 ? "text-silver-100" : "text-red-300"}`}>
                          {item.macdHistogram.toFixed(3)} {item.macdRising ? "↑" : "↓"}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {item.bandarmologyPhase ? (
                  <div className="rounded-2xl p-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.14)" }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-300">Bandarmology</p>
                      <span className="text-xs font-semibold" style={{ color: item.bandarmologyAlignment === "selaras" ? "#6ee7b7" : "#fcd34d" }}>
                        {item.bandarmologyAlignment === "selaras" ? "Selaras" : item.bandarmologyAlignment === "campuran" ? "Masih Perlu Pantau" : "Netral"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-silver-100">{item.bandarmologyPhase}</p>
                    {item.bandarmologyNote ? <p className="mt-1 text-xs leading-relaxed text-silver-400">{item.bandarmologyNote}</p> : null}
                  </div>
                ) : null}

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

                <div className="grid grid-cols-1 gap-2">
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
              </div>
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
