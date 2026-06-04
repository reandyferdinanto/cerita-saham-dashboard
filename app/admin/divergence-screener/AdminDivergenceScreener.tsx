"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, RefreshCw, Filter, ExternalLink, AlertCircle } from "lucide-react";

interface DivergenceResult {
  ticker: string;
  name: string;
  sector: string;
  rsiDivergence: {
    type: "bullish" | "bearish";
    strength: number;
  } | null;
  macdDivergence: {
    type: "bullish" | "bearish";
    strength: number;
  } | null;
  currentPrice: number;
  changePercent: number;
  volume: number;
  lastUpdated: string;
  hasDoubleDivergence: boolean;
  combinedStrength: number;
}

interface ScreenerResponse {
  results: DivergenceResult[];
  totalScanned: number;
  lastScanTime: string;
  cacheAge: number;
  fromCache: boolean;
}

type SortField = "ticker" | "combinedStrength" | "changePercent" | "currentPrice" | "sector";
type SortDirection = "asc" | "desc";

export default function AdminDivergenceScreener() {
  const router = useRouter();
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [divergenceType, setDivergenceType] = useState<"all" | "bullish" | "bearish">("all");
  const [minStrength, setMinStrength] = useState(0);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [doubleDivOnly, setDoubleDivOnly] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("combinedStrength");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (forceRefresh) params.set("refresh", "true");
      if (divergenceType !== "all") params.set("type", divergenceType);
      if (minStrength > 0) params.set("minStrength", minStrength.toString());
      if (selectedSector) params.set("sector", selectedSector);
      if (doubleDivOnly) params.set("doubleDivOnly", "true");

      const res = await fetch(`/api/admin/divergence-screener?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch screener data");

      const json: ScreenerResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [divergenceType, minStrength, selectedSector, doubleDivOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh || !data) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, data, fetchData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedResults = data?.results ? [...data.results].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "ticker" || sortField === "sector") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  }) : [];

  const uniqueSectors = data?.results 
    ? Array.from(new Set(data.results.map(r => r.sector))).sort()
    : [];

  const handleViewChart = (ticker: string) => {
    router.push(`/search?q=${ticker}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-silver-400">Scanning stocks for divergences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <div className="flex items-center gap-3 text-red-300">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-silver-100">Divergence Screener</h2>
          <p className="text-sm text-silver-400 mt-1">
            Real-time detection of RSI and MACD divergence patterns across the market
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              autoRefresh
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-silver-100/[0.04] text-silver-400 border border-silver-200/10"
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? `Auto (${countdown}s)` : "Auto Refresh"}
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Now
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4">
            <p className="text-xs text-silver-400 mb-1">Total Scanned</p>
            <p className="text-2xl font-bold text-silver-100">{data.totalScanned}</p>
          </div>
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4">
            <p className="text-xs text-silver-400 mb-1">Divergences Found</p>
            <p className="text-2xl font-bold text-emerald-300">{data.results.length}</p>
          </div>
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4">
            <p className="text-xs text-silver-400 mb-1">Double Divergence</p>
            <p className="text-2xl font-bold text-amber-300">
              {data.results.filter(r => r.hasDoubleDivergence).length}
            </p>
          </div>
          <div className="rounded-xl border border-silver-200/10 bg-silver-100/[0.04] p-4">
            <p className="text-xs text-silver-400 mb-1">Cache Age</p>
            <p className="text-2xl font-bold text-silver-100">{data.cacheAge}s</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-silver-200/10 bg-silver-100/[0.04] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-silver-400" />
          <h3 className="text-sm font-bold text-silver-200">Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Divergence Type */}
          <div>
            <label className="text-xs font-semibold text-silver-400 mb-2 block">Divergence Type</label>
            <select
              value={divergenceType}
              onChange={(e) => setDivergenceType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-silver-100/[0.04] border border-silver-200/10 text-silver-200 text-sm"
            >
              <option value="all">All</option>
              <option value="bullish">Bullish Only</option>
              <option value="bearish">Bearish Only</option>
            </select>
          </div>

          {/* Min Strength */}
          <div>
            <label className="text-xs font-semibold text-silver-400 mb-2 block">
              Min Strength: {minStrength}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={minStrength}
              onChange={(e) => setMinStrength(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Sector */}
          <div>
            <label className="text-xs font-semibold text-silver-400 mb-2 block">Sector</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-silver-100/[0.04] border border-silver-200/10 text-silver-200 text-sm"
            >
              <option value="">All Sectors</option>
              {uniqueSectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>

          {/* Double Divergence Only */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={doubleDivOnly}
                onChange={(e) => setDoubleDivOnly(e.target.checked)}
                className="w-4 h-4 rounded border-silver-200/20"
              />
              <span className="text-sm text-silver-300">Double Divergence Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="rounded-2xl border border-silver-200/10 bg-silver-100/[0.04] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-silver-200/10">
                <th 
                  onClick={() => handleSort("ticker")}
                  className="px-4 py-3 text-left text-xs font-bold text-silver-300 uppercase tracking-wider cursor-pointer hover:bg-silver-100/[0.04]"
                >
                  Ticker {sortField === "ticker" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-silver-300 uppercase tracking-wider">
                  Name
                </th>
                <th 
                  onClick={() => handleSort("sector")}
                  className="px-4 py-3 text-left text-xs font-bold text-silver-300 uppercase tracking-wider cursor-pointer hover:bg-silver-100/[0.04]"
                >
                  Sector {sortField === "sector" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-silver-300 uppercase tracking-wider">
                  RSI Div
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-silver-300 uppercase tracking-wider">
                  MACD Div
                </th>
                <th 
                  onClick={() => handleSort("combinedStrength")}
                  className="px-4 py-3 text-center text-xs font-bold text-silver-300 uppercase tracking-wider cursor-pointer hover:bg-silver-100/[0.04]"
                >
                  Strength {sortField === "combinedStrength" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th 
                  onClick={() => handleSort("currentPrice")}
                  className="px-4 py-3 text-right text-xs font-bold text-silver-300 uppercase tracking-wider cursor-pointer hover:bg-silver-100/[0.04]"
                >
                  Price {sortField === "currentPrice" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th 
                  onClick={() => handleSort("changePercent")}
                  className="px-4 py-3 text-right text-xs font-bold text-silver-300 uppercase tracking-wider cursor-pointer hover:bg-silver-100/[0.04]"
                >
                  Change {sortField === "changePercent" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-silver-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver-200/10">
              {sortedResults.map((result) => (
                <tr key={result.ticker} className="hover:bg-silver-100/[0.04] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-silver-100">{result.ticker}</span>
                      {result.hasDoubleDivergence && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          2X
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-silver-300 max-w-xs truncate">
                    {result.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-silver-400">
                    {result.sector}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {result.rsiDivergence ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          result.rsiDivergence.type === "bullish"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}>
                          {result.rsiDivergence.type === "bullish" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs font-bold">{result.rsiDivergence.strength}%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-silver-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {result.macdDivergence ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                          result.macdDivergence.type === "bullish"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}>
                          {result.macdDivergence.type === "bullish" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs font-bold">{result.macdDivergence.strength}%</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-silver-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-silver-100">{result.combinedStrength}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-silver-200">
                    {result.currentPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${
                      result.changePercent >= 0 ? "text-emerald-300" : "text-red-300"
                    }`}>
                      {result.changePercent >= 0 ? "+" : ""}{result.changePercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewChart(result.ticker)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Chart
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-silver-400">No divergences found with current filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
