"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BrokerSummaryRow = {
  id: string;
  tradeDate: string;
  brokerCode: string;
  brokerName: string | null;
  symbol: string | null;
  buyFreq: number | null;
  buyVolume: number | null;
  buyValue: number | null;
  sellFreq: number | null;
  sellVolume: number | null;
  sellValue: number | null;
  netVolume: number | null;
  netValue: number | null;
  source: string;
};

type BrokerSummaryStatus = {
  rowCount: number;
  sourceUrl: string | null;
  latestRun: {
    source: string;
    mode: string;
    status: string;
    rowCount: number;
    targetDate: string;
    startedAt: string;
    finishedAt: string | null;
    message: string | null;
  } | null;
};

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
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Belum ada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ada";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return value.toLocaleString("id-ID");
}

function getMessageTone(message: string) {
  return message.toLowerCase().includes("berhasil") ? "text-emerald-300" : "text-red-400";
}

export default function AdminBrokerSummaryPanel() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mode, setMode] = useState<"broker" | "stock">("broker");
  const [status, setStatus] = useState<BrokerSummaryStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [rows, setRows] = useState<BrokerSummaryRow[]>([]);
  const [queryDate, setQueryDate] = useState(today);
  const [queryBroker, setQueryBroker] = useState("");
  const [querySymbol, setQuerySymbol] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [manualText, setManualText] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [uploadDate, setUploadDate] = useState(today);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [remoteDate, setRemoteDate] = useState(today);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState("");
  const [stockRows, setStockRows] = useState<StockSummaryRow[]>([]);
  const [stockRowsError, setStockRowsError] = useState("");
  const [stockRowsLoading, setStockRowsLoading] = useState(false);
  const [stockQueryDate, setStockQueryDate] = useState(today);
  const [stockQuerySymbol, setStockQuerySymbol] = useState("");
  const [stockManualDate, setStockManualDate] = useState(today);
  const [stockManualText, setStockManualText] = useState("");
  const [stockManualLoading, setStockManualLoading] = useState(false);
  const [stockManualMessage, setStockManualMessage] = useState("");
  const [stockUploadDate, setStockUploadDate] = useState(today);
  const [stockUploadFile, setStockUploadFile] = useState<File | null>(null);
  const [stockUploadLoading, setStockUploadLoading] = useState(false);
  const [stockUploadMessage, setStockUploadMessage] = useState("");
  const [stockUploadInputKey, setStockUploadInputKey] = useState(0);
  const [accumulationRows, setAccumulationRows] = useState<StockAccumulationCandidate[]>([]);
  const [accumulationLoading, setAccumulationLoading] = useState(false);
  const [accumulationError, setAccumulationError] = useState("");
  const queryBrokerRef = useRef(queryBroker);
  const querySymbolRef = useRef(querySymbol);
  const stockQuerySymbolRef = useRef(stockQuerySymbol);

  queryBrokerRef.current = queryBroker;
  querySymbolRef.current = querySymbol;
  stockQuerySymbolRef.current = stockQuerySymbol;

  const loadStatus = async () => {
    try {
      setStatusLoading(true);
      setStatusError("");
      const res = await fetch("/api/admin/broker-summary/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat status broker summary");
      setStatus(data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Gagal memuat status broker summary");
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const loadRows = async () => {
    try {
      setLoadingRows(true);
      setRowsError("");
      const qs = new URLSearchParams({ date: queryDate });
      if (queryBroker.trim()) qs.set("broker", queryBroker.trim().toUpperCase());
      if (querySymbol.trim()) qs.set("symbol", querySymbol.trim().toUpperCase());
      const res = await fetch(`/api/admin/broker-summary?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data broker summary");
      setRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setRowsError(err instanceof Error ? err.message : "Gagal memuat data broker summary");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  const loadStockRows = async () => {
    try {
      setStockRowsLoading(true);
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
    } finally {
      setStockRowsLoading(false);
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
      setAccumulationRows(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setAccumulationError(err instanceof Error ? err.message : "Gagal memuat analisa akumulasi");
      setAccumulationRows([]);
    } finally {
      setAccumulationLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDate]);

  useEffect(() => {
    void loadStockRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQueryDate]);

  useEffect(() => {
    void loadAccumulationRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockQueryDate]);

  const submitManualImport = async () => {
    try {
      setManualLoading(true);
      setManualMessage("");
      const res = await fetch("/api/admin/broker-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeDate: manualDate, rawText: manualText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import manual broker summary");
      setManualMessage(`Import berhasil: ${data.rowCount ?? data.parsedRows ?? 0} row.`);
      setManualText("");
      if (manualDate === queryDate) {
        await loadRows();
      }
      await loadStatus();
    } catch (err) {
      setManualMessage(err instanceof Error ? err.message : "Gagal import manual broker summary");
    } finally {
      setManualLoading(false);
    }
  };

  const submitUploadImport = async () => {
    if (!uploadFile) {
      setUploadMessage("Pilih file IDX terlebih dahulu.");
      return;
    }

    try {
      setUploadLoading(true);
      setUploadMessage("");
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("tradeDate", uploadDate);

      const res = await fetch("/api/admin/broker-summary", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload broker summary");
      setUploadMessage(`Upload berhasil: ${data.rowCount ?? data.parsedRows ?? 0} row.`);
      setUploadFile(null);
      setUploadInputKey((value) => value + 1);
      if (uploadDate === queryDate) {
        await loadRows();
      }
      await loadStatus();
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Gagal upload broker summary");
    } finally {
      setUploadLoading(false);
    }
  };

  const triggerRemoteIngest = async () => {
    try {
      setRemoteLoading(true);
      setRemoteMessage("");
      const res = await fetch("/api/admin/broker-summary/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeDate: remoteDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal ingest remote broker summary");
      setRemoteMessage(`Remote ingest berhasil: ${data.rowCount ?? data.parsedRows ?? 0} row.`);
      if (remoteDate === queryDate) {
        await loadRows();
      }
      await loadStatus();
    } catch (err) {
      setRemoteMessage(err instanceof Error ? err.message : "Gagal ingest remote broker summary");
    } finally {
      setRemoteLoading(false);
    }
  };

  const submitStockManualImport = async () => {
    try {
      setStockManualLoading(true);
      setStockManualMessage("");
      const res = await fetch("/api/admin/stock-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeDate: stockManualDate, rawText: stockManualText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal import stock summary");
      setStockManualMessage(`Import berhasil: ${data.rowCount ?? data.parsedRows ?? 0} row.`);
      setStockManualText("");
      if (stockManualDate === stockQueryDate) {
        await loadStockRows();
        await loadAccumulationRows();
      }
    } catch (err) {
      setStockManualMessage(err instanceof Error ? err.message : "Gagal import stock summary");
    } finally {
      setStockManualLoading(false);
    }
  };

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
      if (stockUploadDate === stockQueryDate) {
        await loadStockRows();
        await loadAccumulationRows();
      }
    } catch (err) {
      setStockUploadMessage(err instanceof Error ? err.message : "Gagal upload stock summary");
    } finally {
      setStockUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("broker")}
            className="text-left rounded-2xl px-4 py-4 transition-all"
            style={{
              background: mode === "broker" ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.03)",
              border: mode === "broker" ? "1px solid rgba(59,130,246,0.28)" : "1px solid rgba(226,232,240,0.06)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: mode === "broker" ? "#93c5fd" : "#e2e8f0" }}>Broker Summary</p>
            <p className="text-xs mt-1 text-silver-500">Net buy / net sell broker, upload IDX, import manual, remote ingest, dan cron.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("stock")}
            className="text-left rounded-2xl px-4 py-4 transition-all"
            style={{
              background: mode === "stock" ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
              border: mode === "stock" ? "1px solid rgba(16,185,129,0.28)" : "1px solid rgba(226,232,240,0.06)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: mode === "stock" ? "#6ee7b7" : "#e2e8f0" }}>Stock Summary</p>
            <p className="text-xs mt-1 text-silver-500">Cocok untuk file `.xlsx` seperti `Stock Summary-20260331.xlsx` dari BEI.</p>
          </button>
        </div>
      </div>

      {mode === "broker" ? (
      <>
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-silver-100">Broker Summary</h2>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Modul admin ini menyiapkan pipeline broker summary berbasis database untuk riset internal. Sekarang jalurnya mendukung
              upload file IDX langsung, import manual CSV/TSV, ingest remote dari source URL, dan endpoint cron untuk automasi.
            </p>
          </div>
          <div className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.18)" }}>
            Mongo-backed admin feature
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <p className="text-xs uppercase tracking-[0.18em] text-silver-500">Database Rows</p>
          <p className="text-2xl font-bold text-silver-100 mt-2">{statusLoading ? "..." : formatNumber(status?.rowCount)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <p className="text-xs uppercase tracking-[0.18em] text-silver-500">Last Run</p>
          <p className="text-base font-bold text-silver-100 mt-2">{status?.latestRun?.status ?? "Belum ada"}</p>
          <p className="text-xs text-silver-500 mt-2">{formatDateTime(status?.latestRun?.finishedAt || status?.latestRun?.startedAt)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <p className="text-xs uppercase tracking-[0.18em] text-silver-500">Source Remote</p>
          <p className="text-sm font-semibold text-silver-100 mt-2 break-all">{status?.sourceUrl || "Belum dikonfigurasi"}</p>
        </div>
      </div>

      {statusError ? <p className="text-sm text-red-400">{statusError}</p> : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <h3 className="text-base font-bold text-silver-100">Upload File IDX</h3>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Upload `.xlsx`, `.xlsm`, `.csv`, atau `.txt`. Jika nama file memuat tanggal seperti `20260331`, sistem bisa membacanya otomatis.
            </p>
          </div>
          <input
            type="date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <input
            key={uploadInputKey}
            type="file"
            accept=".xlsx,.xlsm,.csv,.txt"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <p className="text-xs text-silver-500">File terpilih: {uploadFile?.name || "Belum ada"}</p>
          <button
            type="button"
            onClick={() => submitUploadImport()}
            disabled={uploadLoading}
            className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#2563eb,#60a5fa)", color: "#fff" }}
          >
            {uploadLoading ? "Uploading..." : "Upload Broker Summary"}
          </button>
          {uploadMessage ? <p className={`text-sm ${getMessageTone(uploadMessage)}`}>{uploadMessage}</p> : null}
        </div>

        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <h3 className="text-base font-bold text-silver-100">Import Manual CSV / TSV</h3>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Tetap tersedia sebagai fallback kalau Anda ingin paste data broker summary dengan header seperti `brokerCode, brokerName, buyValue, sellValue, netValue`.
            </p>
          </div>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={10}
            placeholder={"brokerCode,brokerName,buyValue,sellValue,netValue\nYP,Mirae,1500000000,1200000000,300000000"}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <button
            type="button"
            onClick={() => submitManualImport()}
            disabled={manualLoading}
            className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}
          >
            {manualLoading ? "Importing..." : "Import Manual"}
          </button>
          {manualMessage ? <p className={`text-sm ${getMessageTone(manualMessage)}`}>{manualMessage}</p> : null}
        </div>

        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
          <div>
            <h3 className="text-base font-bold text-silver-100">Ingest Remote / Cron</h3>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Jalur ini siap untuk source URL atau pipeline scraper terpisah. Isi `BROKER_SUMMARY_SOURCE_URL` bila ingin mencoba ingest remote sekarang,
              lalu cron bisa memanggil endpoint internal `/api/cron/idx-broker-summary`.
            </p>
          </div>
          <input
            type="date"
            value={remoteDate}
            onChange={(e) => setRemoteDate(e.target.value)}
            className="glass-input w-full px-4 py-3 text-sm text-silver-200"
          />
          <button
            type="button"
            onClick={() => triggerRemoteIngest()}
            disabled={remoteLoading}
            className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff" }}
          >
            {remoteLoading ? "Ingesting..." : "Run Remote Ingest"}
          </button>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
            <p className="text-xs uppercase tracking-[0.18em] text-silver-500">Endpoint Cron</p>
            <p className="text-sm text-silver-300 mt-2 break-all">GET /api/cron/idx-broker-summary?date=YYYY-MM-DD</p>
            <p className="text-xs text-silver-500 mt-2">Gunakan header `Authorization: Bearer CRON_SECRET`.</p>
          </div>
          {remoteMessage ? <p className={`text-sm ${getMessageTone(remoteMessage)}`}>{remoteMessage}</p> : null}
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-silver-100">Data Browser</h3>
            <p className="text-sm text-silver-400 mt-2">Filter data broker summary yang sudah tersimpan di database.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
            <input type="date" value={queryDate} onChange={(e) => setQueryDate(e.target.value)} className="glass-input px-4 py-3 text-sm text-silver-200" />
            <input value={queryBroker} onChange={(e) => setQueryBroker(e.target.value.toUpperCase())} placeholder="Broker code" className="glass-input px-4 py-3 text-sm text-silver-200" />
            <input value={querySymbol} onChange={(e) => setQuerySymbol(e.target.value.toUpperCase())} placeholder="Symbol (opsional)" className="glass-input px-4 py-3 text-sm text-silver-200" />
            <button type="button" onClick={() => loadRows()} className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(251,146,60,0.12)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.18)" }}>
              Load
            </button>
          </div>
        </div>

        {rowsError ? <p className="text-sm text-red-400">{rowsError}</p> : null}

        {loadingRows ? (
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full min-w-[900px] text-sm">
              <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                <tr className="text-silver-400">
                  <th className="text-left p-3">Broker</th>
                  <th className="text-left p-3">Symbol</th>
                  <th className="text-right p-3">Buy Value</th>
                  <th className="text-right p-3">Sell Value</th>
                  <th className="text-right p-3">Net Value</th>
                  <th className="text-right p-3">Buy Vol</th>
                  <th className="text-right p-3">Sell Vol</th>
                  <th className="text-left p-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="p-3 text-silver-100">
                      <div className="font-semibold">{row.brokerCode}</div>
                      <div className="text-xs text-silver-500 mt-1">{row.brokerName || "-"}</div>
                    </td>
                    <td className="p-3 text-silver-300">{row.symbol || "-"}</td>
                    <td className="p-3 text-right text-silver-200">{formatNumber(row.buyValue)}</td>
                    <td className="p-3 text-right text-silver-200">{formatNumber(row.sellValue)}</td>
                    <td className={`p-3 text-right font-semibold ${row.netValue != null && row.netValue >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatNumber(row.netValue)}</td>
                    <td className="p-3 text-right text-silver-300">{formatNumber(row.buyVolume)}</td>
                    <td className="p-3 text-right text-silver-300">{formatNumber(row.sellVolume)}</td>
                    <td className="p-3 text-silver-500">{row.source}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-silver-500">Belum ada data broker summary untuk filter ini.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : null}

      {mode === "stock" ? (
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(226,232,240,0.06)" }}>
            <h2 className="text-lg font-bold text-silver-100">Stock Summary</h2>
            <p className="text-sm text-silver-400 mt-2 leading-relaxed">
              Mode ini sekarang mendukung upload file `.xlsx` IDX langsung. Parser menargetkan header `Stock Code`, `Company Name`, `Open Price`, `High`, `Low`,
              `Close`, `Volume`, `Value`, `Foreign Sell`, `Foreign Buy`, dan kolom stock summary BEI lainnya.
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-base font-bold text-silver-100">Analisa Akumulasi dan Mau Jalan</h3>
                <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                  Shortlist ini mengutamakan saham dengan jejak serap, foreign flow yang mendukung, bid lebih tebal dari offer, dan penutupan yang sudah rapat ke high hariannya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadAccumulationRows()}
                className="px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}
              >
                Refresh Analisa
              </button>
            </div>

            {accumulationError ? <p className="text-sm text-red-400">{accumulationError}</p> : null}

            {accumulationLoading ? (
              <div className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ) : accumulationRows.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {accumulationRows.map((item) => (
                  <div
                    key={item.stockCode}
                    className="rounded-2xl p-4 space-y-4"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.08)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-silver-100">{item.stockCode}</p>
                        <p className="text-sm text-silver-400 mt-1">{item.companyName || "-"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background:
                              item.phase === "Akumulasi Siap Jalan"
                                ? "rgba(16,185,129,0.16)"
                                : item.phase === "Akumulasi Kuat"
                                  ? "rgba(59,130,246,0.16)"
                                  : "rgba(250,204,21,0.14)",
                            color:
                              item.phase === "Akumulasi Siap Jalan"
                                ? "#6ee7b7"
                                : item.phase === "Akumulasi Kuat"
                                  ? "#93c5fd"
                                  : "#fde68a",
                            border:
                              item.phase === "Akumulasi Siap Jalan"
                                ? "1px solid rgba(16,185,129,0.28)"
                                : item.phase === "Akumulasi Kuat"
                                  ? "1px solid rgba(59,130,246,0.28)"
                                  : "1px solid rgba(250,204,21,0.24)",
                          }}
                        >
                          {item.phase}
                        </div>
                        <div
                          className="px-3 py-1.5 rounded-full text-xs font-bold"
                          style={{
                            background:
                              item.convictionLabel === "Sangat Kuat"
                                ? "rgba(234,88,12,0.16)"
                                : item.convictionLabel === "Kuat"
                                  ? "rgba(168,85,247,0.16)"
                                  : item.convictionLabel === "Menarik"
                                    ? "rgba(14,165,233,0.16)"
                                    : "rgba(148,163,184,0.12)",
                            color:
                              item.convictionLabel === "Sangat Kuat"
                                ? "#fdba74"
                                : item.convictionLabel === "Kuat"
                                  ? "#d8b4fe"
                                  : item.convictionLabel === "Menarik"
                                    ? "#7dd3fc"
                                    : "#cbd5e1",
                            border:
                              item.convictionLabel === "Sangat Kuat"
                                ? "1px solid rgba(234,88,12,0.28)"
                                : item.convictionLabel === "Kuat"
                                  ? "1px solid rgba(168,85,247,0.28)"
                                  : item.convictionLabel === "Menarik"
                                    ? "1px solid rgba(14,165,233,0.24)"
                                    : "1px solid rgba(148,163,184,0.18)",
                          }}
                        >
                          Conviction {item.convictionScore} · {item.convictionLabel}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-silver-500">Close</p>
                        <p className="mt-1 font-semibold text-silver-100">{formatNumber(item.close)}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Net Foreign</p>
                        <p className={`mt-1 font-semibold ${item.netForeign >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatNumber(item.netForeign)}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Skor Akumulasi</p>
                        <p className="mt-1 font-semibold text-silver-100">{formatNumber(item.accumulationScore)}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Skor Siap Jalan</p>
                        <p className="mt-1 font-semibold text-silver-100">{formatNumber(item.readinessScore)}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Smart Money Conviction</p>
                        <p className="mt-1 font-semibold text-silver-100">{formatNumber(item.convictionScore)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-silver-500">Close ke High</p>
                        <p className="mt-1 text-silver-200">{item.closeToHighPercent == null ? "-" : `${item.closeToHighPercent}%`}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Bid/Offer</p>
                        <p className="mt-1 text-silver-200">{item.bidOfferRatio == null ? "-" : `${item.bidOfferRatio}x`}</p>
                      </div>
                      <div>
                        <p className="text-silver-500">Value</p>
                        <p className="mt-1 text-silver-200">{formatNumber(item.value)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-silver-200">Pembacaan cepat</p>
                      <p className="text-sm text-silver-400 mt-2 leading-relaxed">{item.summary}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.reasons.map((reason) => (
                        <span
                          key={`${item.stockCode}-${reason}`}
                          className="px-2.5 py-1 rounded-full text-xs"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(226,232,240,0.06)" }}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center text-sm text-silver-500" style={{ background: "rgba(255,255,255,0.04)" }}>
                Belum ada kandidat kuat untuk tanggal ini. Coba upload stock summary lain atau cek lagi setelah sesi market berikutnya.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
              <div>
                <h3 className="text-base font-bold text-silver-100">Upload File IDX</h3>
                <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                  Upload file `Stock Summary` langsung dari IDX. Nama file seperti `Stock Summary-20260331.xlsx` bisa membantu sistem membaca tanggal otomatis.
                </p>
              </div>
              <input type="date" value={stockUploadDate} onChange={(e) => setStockUploadDate(e.target.value)} className="glass-input w-full px-4 py-3 text-sm text-silver-200" />
              <input
                key={stockUploadInputKey}
                type="file"
                accept=".xlsx,.xlsm,.csv,.txt"
                onChange={(e) => setStockUploadFile(e.target.files?.[0] || null)}
                className="glass-input w-full px-4 py-3 text-sm text-silver-200"
              />
              <p className="text-xs text-silver-500">File terpilih: {stockUploadFile?.name || "Belum ada"}</p>
              <button
                type="button"
                onClick={() => submitStockUploadImport()}
                disabled={stockUploadLoading}
                className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff" }}
              >
                {stockUploadLoading ? "Uploading..." : "Upload Stock Summary"}
              </button>
              {stockUploadMessage ? <p className={`text-sm ${getMessageTone(stockUploadMessage)}`}>{stockUploadMessage}</p> : null}
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
              <div>
                <h3 className="text-base font-bold text-silver-100">Import Manual Stock Summary</h3>
                <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                  Tetap tersedia sebagai fallback kalau Anda ingin paste hasil copy dari Excel sebagai TSV/CSV.
                </p>
              </div>
              <input type="date" value={stockManualDate} onChange={(e) => setStockManualDate(e.target.value)} className="glass-input w-full px-4 py-3 text-sm text-silver-200" />
              <textarea
                value={stockManualText}
                onChange={(e) => setStockManualText(e.target.value)}
                rows={10}
                placeholder={"Stock Code\tCompany Name\tOpen Price\tHigh\tLow\tClose\tVolume\tValue\tForeign Sell\tForeign Buy\nBBCA\tBank Central Asia Tbk.\t9100\t9200\t9050\t9150\t12000000\t109000000000\t24000000000\t26000000000"}
                className="glass-input w-full px-4 py-3 text-sm text-silver-200"
              />
              <button
                type="button"
                onClick={() => submitStockManualImport()}
                disabled={stockManualLoading}
                className="px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)", color: "#fff" }}
              >
                {stockManualLoading ? "Importing..." : "Import Manual"}
              </button>
              {stockManualMessage ? <p className={`text-sm ${getMessageTone(stockManualMessage)}`}>{stockManualMessage}</p> : null}
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
              <div>
                <h3 className="text-base font-bold text-silver-100">Panduan Format</h3>
                <p className="text-sm text-silver-400 mt-2 leading-relaxed">
                  Sistem sekarang memprioritaskan upload file `.xlsx` IDX. Paste manual tetap ada untuk berjaga-jaga kalau file perlu dibersihkan dulu.
                </p>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <p className="text-xs uppercase tracking-[0.18em] text-silver-500">Kolom yang didukung</p>
                <p className="text-sm text-silver-300 mt-3 leading-relaxed">
                  `Stock Code`, `Company Name`, `Remarks`, `Previous`, `Open Price`, `First Trade`, `High`, `Low`, `Close`, `Change`,
                  `Volume`, `Value`, `Frequency`, `Index Individual`, `Offer`, `Offer Volume`, `Bid`, `Bid Volume`, `Listed Shares`,
                  `Tradeble Shares`, `Weight For Index`, `Foreign Sell`, `Foreign Buy`, `Non Regular Volume`, `Non Regular Value`,
                  `Non Regular Frequency`.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,232,240,0.06)" }}>
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-silver-100">Stock Summary Browser</h3>
                <p className="text-sm text-silver-400 mt-2">Lihat data stock summary yang sudah tersimpan di database.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                <input type="date" value={stockQueryDate} onChange={(e) => setStockQueryDate(e.target.value)} className="glass-input px-4 py-3 text-sm text-silver-200" />
                <input value={stockQuerySymbol} onChange={(e) => setStockQuerySymbol(e.target.value.toUpperCase())} placeholder="Stock code" className="glass-input px-4 py-3 text-sm text-silver-200" />
                <button type="button" onClick={() => loadStockRows()} className="px-4 py-3 rounded-xl text-sm font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.18)" }}>
                  Load
                </button>
              </div>
            </div>

            {stockRowsError ? <p className="text-sm text-red-400">{stockRowsError}</p> : null}

            {stockRowsLoading ? (
              <div className="h-40 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                    <tr className="text-silver-400">
                      <th className="text-left p-3">Kode</th>
                      <th className="text-left p-3">Company</th>
                      <th className="text-right p-3">Open</th>
                      <th className="text-right p-3">High</th>
                      <th className="text-right p-3">Low</th>
                      <th className="text-right p-3">Close</th>
                      <th className="text-right p-3">Volume</th>
                      <th className="text-right p-3">Value</th>
                      <th className="text-right p-3">Foreign Sell</th>
                      <th className="text-right p-3">Foreign Buy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.length > 0 ? stockRows.map((row) => (
                      <tr key={row.id} className="border-t border-white/5">
                        <td className="p-3 text-silver-100 font-semibold">{row.stockCode}</td>
                        <td className="p-3 text-silver-300">{row.companyName || "-"}</td>
                        <td className="p-3 text-right text-silver-300">{formatNumber(row.openPrice)}</td>
                        <td className="p-3 text-right text-silver-300">{formatNumber(row.high)}</td>
                        <td className="p-3 text-right text-silver-300">{formatNumber(row.low)}</td>
                        <td className="p-3 text-right text-silver-100 font-semibold">{formatNumber(row.close)}</td>
                        <td className="p-3 text-right text-silver-300">{formatNumber(row.volume)}</td>
                        <td className="p-3 text-right text-silver-300">{formatNumber(row.value)}</td>
                        <td className="p-3 text-right text-red-300">{formatNumber(row.foreignSell)}</td>
                        <td className="p-3 text-right text-emerald-300">{formatNumber(row.foreignBuy)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-silver-500">Belum ada data stock summary untuk filter ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
