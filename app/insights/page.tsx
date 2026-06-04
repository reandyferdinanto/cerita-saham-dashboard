"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Radio,
  Rows3,
  TrendingUp,
  Flame,
  Search,
  X,
  Filter,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import { TitleWithPills, StockQuickModal } from "@/components/ui/TickerPill";

interface NewsItem {
  title: string;
  link?: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

interface ArticleItem {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  isPublic: boolean;
  authorId?: { name: string; email: string } | null;
  createdAt: string;
  extractedTickers?: Array<{
    ticker: string;
    fullTicker: string;
    relevanceScore: number;
    isPrimary: boolean;
    mentionCount: number;
  }>;
  metadata?: {
    sentiment?: "positive" | "negative" | "neutral";
    sentimentScore?: number;
    impactLevel?: "high" | "medium" | "low";
    articleType?: string;
    sectors?: string[];
    viewCount?: number;
  };
}

interface TickerStats {
  ticker: string;
  fullTicker: string;
  articleCount: number;
  totalRelevance: number;
  avgRelevance: number;
  primaryMentions: number;
  sectors: string[];
  latestMention: string;
}

interface TrendingTicker {
  ticker: string;
  fullTicker: string;
  articleCount: number;
  recentMentions: number;
  trendScore: number;
  sentiment: "positive" | "negative" | "neutral";
  avgSentimentScore: number;
  latestArticle: {
    id: string;
    title: string;
    createdAt: string;
  };
}

const DEFAULT_MARKET_NEWS: NewsItem[] = [
  {
    title: "Pantau rotasi sektor, IHSG, dan saham yang mempertahankan level support setelah penutupan",
    description:
      "Memuat berita terkini dari berbagai sumber. Gunakan ringkasan ini sebagai pengingat untuk membaca arah indeks, volume, dan reaksi saham pilihan.",
    pubDate: new Date().toISOString(),
    source: "Market Radar",
  },
  {
    title: "Fokus pada saham dengan volume sehat, penutupan dekat harga tertinggi, dan risiko stop loss yang terukur",
    description:
      "Alur kerja Anomali Saham tetap mengutamakan analisis harga-volume dan rencana trading yang terukur.",
    pubDate: new Date().toISOString(),
    source: "Anomali Saham",
  },
];

const AUTO_ARTICLE_VISIBLE_DAYS = 5;
const AUTO_ARTICLE_VISIBLE_MS = AUTO_ARTICLE_VISIBLE_DAYS * 24 * 60 * 60 * 1000;

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function cleanExcerpt(value: string, limit = 180) {
  const text = value
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[#*_>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function isAutoArticle(article: ArticleItem) {
  return !article.authorId;
}

function shouldShowArticle(article: ArticleItem) {
  if (!isAutoArticle(article)) return true;

  const createdAt = new Date(article.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= AUTO_ARTICLE_VISIBLE_MS;
}

function getArticleKind(article: ArticleItem) {
  return isAutoArticle(article) ? "Artikel AI" : "Artikel Khusus";
}

function getArticleKindClass(article: ArticleItem) {
  return isAutoArticle(article)
    ? "border-orange-200/20 bg-orange-100/10 text-orange-200"
    : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";
}

function getSentimentColor(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "text-emerald-300 bg-emerald-300/10 border-emerald-300/20";
    case "negative":
      return "text-red-300 bg-red-300/10 border-red-300/20";
    default:
      return "text-silver-300 bg-silver-300/10 border-silver-300/20";
  }
}

function getSentimentIcon(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "↗";
    case "negative":
      return "↘";
    default:
      return "→";
  }
}

function getImpactColor(impact?: string) {
  switch (impact) {
    case "high":
      return "text-red-300 bg-red-300/10 border-red-300/20";
    case "medium":
      return "text-amber-300 bg-amber-300/10 border-amber-300/20";
    case "low":
      return "text-blue-300 bg-blue-300/10 border-blue-300/20";
    default:
      return "text-silver-300 bg-silver-300/10 border-silver-300/20";
  }
}

function getImpactLabel(impact?: string) {
  switch (impact) {
    case "high":
      return "High Impact";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Info";
  }
}

function ArticleVisual({ article, featured = false }: { article: ArticleItem; featured?: boolean }) {
  if (article.imageUrl) {
    return (
      <img
        src={article.imageUrl}
        alt=""
        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
      />
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 74% 22%, rgba(249,115,22,0.32), transparent 32%), linear-gradient(135deg, rgba(9,37,29,0.98), rgba(61,35,21,0.96))",
      }}
    >
      <div className="absolute inset-x-8 top-8 h-px bg-silver-200/15" />
      <div className="absolute inset-x-8 bottom-8 h-px bg-silver-200/10" />
      <div className="absolute left-8 top-8 bottom-8 w-px bg-silver-200/10" />
      <div className="absolute right-8 top-8 bottom-8 w-px bg-silver-200/10" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 360" aria-hidden="true">
        <path d="M70 254 C144 196 190 218 250 156 C304 100 354 138 428 82 C474 48 514 52 552 34" fill="none" stroke="rgba(251,146,60,0.74)" strokeWidth="8" strokeLinecap="round" />
        <path d="M70 254 C144 196 190 218 250 156 C304 100 354 138 428 82 C474 48 514 52 552 34" fill="none" stroke="rgba(226,232,240,0.16)" strokeWidth="22" strokeLinecap="round" />
        {[112, 178, 244, 310, 376, 442].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={96 + i * 14} x2={x} y2={226 - i * 12} stroke={i % 2 ? "rgba(239,91,91,0.9)" : "rgba(16,185,129,0.9)"} strokeWidth="4" strokeLinecap="round" />
            <rect x={x - 12} y={130 + i * 8} width="24" height={featured ? 74 : 56} rx="7" fill={i % 2 ? "rgba(239,91,91,0.88)" : "rgba(16,185,129,0.88)"} />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-7 left-8 right-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300/80">Market Journal</p>
        <p className="mt-2 max-w-[24rem] text-lg font-black leading-tight text-silver-100">
          {featured ? "Close reading untuk saham IDX" : "IDX insight"}
        </p>
      </div>
    </div>
  );
}

function NewsCard({
  item,
  onOpenTicker,
  compact = false,
}: {
  item: NewsItem;
  compact?: boolean;
  onOpenTicker: (ticker: string, fullTicker: string) => void;
}) {
  return (
    <article className="group rounded-[22px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-4 transition duration-300 hover:border-orange-400/35 hover:bg-[oklch(15%_0.024_150_/_0.82)] focus-within:ring-2 focus-within:ring-orange-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 sm:rounded-[24px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        {!compact && item.image ? (
          <div className="h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-silver-200/5 sm:h-20 sm:w-24 sm:rounded-xl">
            <img src={item.image} alt="" className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-silver-300 sm:tracking-[0.14em]">
            <span className="text-orange-300">{item.source}</span>
            <span className="text-silver-600">|</span>
            <span>{formatDate(item.pubDate, false)}</span>
          </div>
          <h3 className="text-[0.92rem] font-extrabold leading-snug text-silver-100 sm:text-sm">
            <TitleWithPills text={item.title} onOpen={onOpenTicker} />
          </h3>
          {!compact && item.description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-silver-300">{item.description}</p>
          ) : null}
          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-orange-300 transition hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded"
            >
              Buka sumber <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function InsightsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFilter = (searchParams.get("q") || "").trim().toUpperCase();
  const tickerFilter = searchParams.get("ticker") || "";
  const sentimentFilter = searchParams.get("sentiment") as "positive" | "negative" | "neutral" | "" || "";
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [trendingTickers, setTrendingTickers] = useState<TrendingTicker[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [allTickers, setAllTickers] = useState<TickerStats[]>([]);
  const [tickersLoading, setTickersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [modalTicker, setModalTicker] = useState<{ ticker: string; fullTicker: string } | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const res = await fetch("/api/news");
        const data = await res.json();
        if (Array.isArray(data)) setNews(data);
      } catch {
        console.error("Failed to fetch news");
      } finally {
        setNewsLoading(false);
      }
    };

    const fetchArticles = async () => {
      try {
        setArticlesLoading(true);
        const res = await fetch("/api/articles");
        const data = await res.json();
        if (Array.isArray(data)) setArticles(data.filter(shouldShowArticle));
      } catch {
        console.error("Failed to fetch articles");
      } finally {
        setArticlesLoading(false);
      }
    };

    const fetchTrending = async () => {
      try {
        setTrendingLoading(true);
        const res = await fetch("/api/insights/trending?limit=12&hours=48");
        const data = await res.json();
        if (data.trending) setTrendingTickers(data.trending);
      } catch {
        console.error("Failed to fetch trending tickers");
      } finally {
        setTrendingLoading(false);
      }
    };

    const fetchAllTickers = async () => {
      try {
        setTickersLoading(true);
        const res = await fetch("/api/insights/tickers?days=30&minArticles=1");
        const data = await res.json();
        if (data.tickers) setAllTickers(data.tickers);
      } catch {
        console.error("Failed to fetch all tickers");
      } finally {
        setTickersLoading(false);
      }
    };

    fetchNews();
    fetchArticles();
    fetchTrending();
    fetchAllTickers();
  }, []);

  // Helper functions for filtering
  const handleTickerFilter = (ticker: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (ticker === tickerFilter) {
      params.delete("ticker");
    } else {
      params.set("ticker", ticker);
    }
    router.push(`/insights?${params.toString()}`);
  };

  const handleSentimentFilter = (sentiment: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sentiment === sentimentFilter) {
      params.delete("sentiment");
    } else {
      params.set("sentiment", sentiment);
    }
    router.push(`/insights?${params.toString()}`);
  };

  const clearAllFilters = () => {
    router.push("/insights");
  };

  const handleSearchSelect = (ticker: string) => {
    handleTickerFilter(ticker);
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  // Filter articles based on ticker and sentiment
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // Filter by ticker
    if (tickerFilter) {
      filtered = filtered.filter((article) =>
        article.extractedTickers?.some((t) => t.ticker === tickerFilter)
      );
    }

    // Filter by sentiment
    if (sentimentFilter) {
      filtered = filtered.filter(
        (article) => article.metadata?.sentiment === sentimentFilter
      );
    }

    return filtered;
  }, [articles, tickerFilter, sentimentFilter]);

  const featuredArticle = filteredArticles[0];
  const secondaryArticles = filteredArticles.slice(1, 7);
  
  const visibleNews = useMemo(() => {
    const base = news.length > 0 ? news : DEFAULT_MARKET_NEWS;
    if (!queryFilter) return base;
    const filtered = base.filter((item) => {
      const haystack = `${item.title} ${item.description}`.toUpperCase();
      return haystack.includes(queryFilter);
    });
    return filtered.length > 0 ? filtered : base;
  }, [news, queryFilter]);

  // Search autocomplete suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const query = searchQuery.toUpperCase();
    return allTickers
      .filter(
        (t) =>
          t.ticker.includes(query) ||
          t.fullTicker.toUpperCase().includes(query)
      )
      .slice(0, 8);
  }, [searchQuery, allTickers]);

  const filteredCount = useMemo(() => {
    if (!queryFilter) return 0;
    const base = news.length > 0 ? news : DEFAULT_MARKET_NEWS;
    return base.filter((item) => `${item.title} ${item.description}`.toUpperCase().includes(queryFilter)).length;
  }, [news, queryFilter]);
  
  const autoArticleCount = filteredArticles.filter(isAutoArticle).length;
  const manualArticleCount = filteredArticles.filter((article) => !isAutoArticle(article)).length;
  const ipotNewsCount = visibleNews.filter((item) => item.source.toLowerCase().includes("ipot")).length;
  const cnbcNewsCount = visibleNews.filter((item) => item.source.toLowerCase().includes("cnbc")).length;
  const hasActiveFilters = tickerFilter || sentimentFilter;

  return (
    <div className="dashboard-typography space-y-10 pb-8">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-200/10 bg-[oklch(14%_0.024_150_/_0.86)] shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:rounded-[44px]">
        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              "radial-gradient(circle at 86% 8%, oklch(68% 0.13 68 / 0.18), transparent 30%), linear-gradient(135deg, oklch(16% 0.024 150 / 0.96), oklch(10% 0.015 115 / 0.98))",
          }}
        />
        <div className="relative grid gap-6 p-6 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)] lg:p-10">
          <div className="flex min-h-0 flex-col justify-between lg:min-h-[440px]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-orange-100/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-100 sm:text-[11px] sm:tracking-[0.16em]">
                  <Radio className="h-3.5 w-3.5" />
                  Insight Desk
                </span>
                <span className="rounded-full border border-silver-200/10 bg-silver-100/[0.06] px-3 py-1.5 text-xs font-semibold text-silver-300">
                  Detik + IPOT + CNBC + Bisnis
                </span>
              </div>
              <h1 className="max-w-4xl text-3xl font-extrabold leading-[0.92] tracking-[-0.055em] text-[oklch(94%_0.02_96)] sm:text-5xl lg:text-7xl">
                Insight Desk untuk membaca pasar tanpa terlalu banyak noise.
              </h1>
              <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-[oklch(82%_0.025_105)] sm:mt-6 sm:text-base sm:leading-8">
                Artikel Khusus, Artikel AI 5 hari terakhir, dan berita pasar dari Detik, IPOT, CNBC Indonesia, serta Bisnis.com dikumpulkan dalam satu halaman yang lebih rapi untuk riset harian.
              </p>

              {queryFilter ? (
                <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Filter aktif</span>
                  <span className="font-bold text-amber-100">{queryFilter}</span>
                  <span className="text-xs text-amber-200/80">
                    {filteredCount > 0
                      ? `${filteredCount} berita ditemukan`
                      : "Tidak ada berita ditemukan"}
                  </span>
                  <Link
                    href="/insights"
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                  >
                    Hapus filter
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
              {[
                { label: "Total Artikel", value: articlesLoading ? "..." : String(articles.length), icon: BookOpen },
                { label: "Artikel AI", value: articlesLoading ? "..." : String(autoArticleCount), icon: Radio },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[20px] border border-silver-200/10 bg-silver-100/[0.045] p-4 backdrop-blur-xl sm:rounded-[24px] sm:p-6">
                    <Icon className="mb-3 h-5 w-5 text-orange-300" />
                    <p className="text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">{item.value}</p>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-silver-400 sm:text-[11px]">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[26px] border border-silver-200/10 bg-[oklch(10%_0.016_145_/_0.72)] p-4 shadow-2xl backdrop-blur-xl sm:rounded-[32px] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200">Berita Terkini</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-silver-100">Market Wire</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                <Rows3 className="h-4 w-4" />
              </span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-silver-300">
              {newsLoading ? "Memuat berita pasar..." : `${visibleNews.length} berita aktif, ${ipotNewsCount} IPOT, ${cnbcNewsCount} CNBC.`}
            </p>
            <div className="space-y-3">
              {newsLoading
                ? [...Array(4)].map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-2xl bg-silver-200/[0.045]" />
                ))
                : visibleNews.slice(0, 4).map((item, index) => (
                  <NewsCard
                    key={`${item.link || item.title}-${index}`}
                    item={item}
                    compact
                    onOpenTicker={(ticker, fullTicker) => setModalTicker({ ticker, fullTicker })}
                  />
                ))}
            </div>
          </aside>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200">Filter & Search</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Cari Artikel Berdasarkan Saham</h2>
          </div>
          <button
            onClick={clearAllFilters}
            className={`inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
              hasActiveFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <X className="h-4 w-4" />
            Hapus Semua Filter
          </button>
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-silver-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              placeholder="Cari ticker saham (contoh: BBCA, GOTO, TLKM)..."
              className="w-full rounded-[20px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] py-4 pl-12 pr-4 text-sm text-silver-100 placeholder-silver-400 transition focus:border-orange-400/35 focus:bg-[oklch(15%_0.024_150_/_0.82)] focus:outline-none focus:ring-2 focus:ring-orange-400/20"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchSuggestions.length > 0 && (
            <div className="absolute top-full z-50 mt-2 w-full rounded-[20px] border border-silver-200/10 bg-[oklch(10%_0.016_145_/_0.95)] p-2 shadow-2xl backdrop-blur-xl">
              {searchSuggestions.map((ticker) => (
                <button
                  key={ticker.ticker}
                  onClick={() => handleSearchSelect(ticker.ticker)}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-silver-100/[0.08]"
                >
                  <div>
                    <p className="font-bold text-silver-100">{ticker.ticker}</p>
                    <p className="text-xs text-silver-400">{ticker.fullTicker}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-orange-300">{ticker.articleCount} artikel</p>
                    <p className="text-[10px] text-silver-500">Relevansi: {ticker.avgRelevance.toFixed(0)}%</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        <div className={`flex flex-wrap items-center gap-2 transition-opacity ${hasActiveFilters ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-silver-400">Filter Aktif:</span>
          {tickerFilter && (
            <button
              onClick={() => handleTickerFilter(tickerFilter)}
              className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1.5 text-sm font-bold text-orange-300 transition hover:bg-orange-300/20"
            >
              {tickerFilter}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {sentimentFilter && (
            <button
              onClick={() => handleSentimentFilter(sentimentFilter)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition ${getSentimentColor(sentimentFilter)} hover:opacity-80`}
            >
              {sentimentFilter === "positive" ? "Positif" : sentimentFilter === "negative" ? "Negatif" : "Netral"}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-xs text-silver-400">
            {filteredArticles.length} artikel ditemukan
          </span>
        </div>

        {/* Sentiment Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-silver-400">Sentimen:</span>
          {["positive", "negative", "neutral"].map((sentiment) => (
            <button
              key={sentiment}
              onClick={() => handleSentimentFilter(sentiment)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                sentimentFilter === sentiment
                  ? getSentimentColor(sentiment)
                  : "border-silver-200/10 bg-silver-100/[0.045] text-silver-300 hover:bg-silver-100/[0.08]"
              }`}
            >
              {getSentimentIcon(sentiment)} {sentiment === "positive" ? "Positif" : sentiment === "negative" ? "Negatif" : "Netral"}
            </button>
          ))}
        </div>
      </section>

      {/* Trending Tickers Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200">Trending Stocks</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Saham Paling Banyak Dibahas</h2>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-300/20 bg-orange-300/10">
            <Flame className="h-5 w-5 text-orange-300" />
          </span>
        </div>
        <p className="max-w-2xl text-sm text-silver-300">
          Saham yang paling sering muncul dalam artikel dan berita 48 jam terakhir, diurutkan berdasarkan frekuensi dan relevansi.
        </p>

        {trendingLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-silver-200/[0.045]" />
            ))}
          </div>
        ) : trendingTickers.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trendingTickers.map((ticker) => (
              <div
                key={ticker.ticker}
                className="group rounded-[20px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-4 transition duration-300 hover:border-orange-400/35 hover:bg-[oklch(15%_0.024_150_/_0.82)]"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <button
                    onClick={() => handleTickerFilter(ticker.ticker)}
                    className="flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
                  >
                    <p className="text-lg font-black text-silver-100 group-hover:text-orange-200">{ticker.ticker}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-silver-400">{ticker.fullTicker}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 text-xs font-bold ${getSentimentColor(ticker.sentiment)}`}>
                      {getSentimentIcon(ticker.sentiment)}
                    </span>
                    <button
                      onClick={() => setModalTicker({ ticker: ticker.ticker, fullTicker: ticker.fullTicker })}
                      className="rounded-lg border border-silver-200/10 bg-silver-100/[0.045] p-1.5 transition hover:bg-silver-100/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                      title="Lihat Chart"
                    >
                      <TrendingUp className="h-3.5 w-3.5 text-orange-300" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-silver-400">Artikel</span>
                    <span className="font-bold text-silver-200">{ticker.articleCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-silver-400">24h terakhir</span>
                    <span className="font-bold text-orange-300">{ticker.recentMentions}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-silver-400">Trend Score</span>
                    <span className="font-bold text-silver-200">{ticker.trendScore.toFixed(0)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleTickerFilter(ticker.ticker)}
                  className="mt-3 w-full rounded-lg border border-silver-200/10 bg-silver-100/[0.045] px-3 py-2 text-left transition hover:bg-silver-100/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-silver-400">
                    {ticker.latestArticle.title}
                  </p>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-silver-200/10 bg-silver-200/[0.035] p-8 text-center">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 text-silver-400" />
            <p className="text-sm text-silver-300">Belum ada data trending untuk periode ini.</p>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        {articlesLoading ? (
          <div className="h-[420px] animate-pulse rounded-[30px] bg-silver-200/[0.045] sm:h-[560px] sm:rounded-[36px]" />
        ) : featuredArticle ? (
          <Link
            href={`/articles/${featuredArticle._id}`}
            className="group overflow-hidden rounded-[30px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.78)] shadow-[0_30px_90px_rgba(0,0,0,0.28)] transition duration-500 hover:-translate-y-1 hover:border-orange-300/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:rounded-[36px]"
          >
            <div className="grid min-h-0 sm:min-h-[560px] lg:grid-rows-[320px_1fr]">
              <div className="h-56 overflow-hidden sm:h-auto">
                <ArticleVisual article={featuredArticle} featured />
              </div>
              <div className="flex flex-col p-6 sm:p-8">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-silver-400 sm:mb-4 sm:gap-3 sm:text-xs sm:tracking-[0.14em]">
                  <span>{formatDate(featuredArticle.createdAt, false)}</span>
                  <span className="text-silver-700">|</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] ${getArticleKindClass(featuredArticle)}`}>
                    {getArticleKind(featuredArticle)}
                  </span>
                  {featuredArticle.metadata?.sentiment && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] ${getSentimentColor(featuredArticle.metadata.sentiment)}`}>
                      {getSentimentIcon(featuredArticle.metadata.sentiment)} {featuredArticle.metadata.sentiment}
                    </span>
                  )}
                  {featuredArticle.metadata?.impactLevel && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] ${getImpactColor(featuredArticle.metadata.impactLevel)}`}>
                      {getImpactLabel(featuredArticle.metadata.impactLevel)}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.04em] text-silver-100 sm:text-4xl">
                  {featuredArticle.title}
                </h2>
                
                {/* Extracted Tickers Pills */}
                {featuredArticle.extractedTickers && featuredArticle.extractedTickers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {featuredArticle.extractedTickers.slice(0, 5).map((ticker) => (
                      <button
                        key={ticker.ticker}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTickerFilter(ticker.ticker);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:scale-105 ${
                          ticker.isPrimary
                            ? "border-orange-300/30 bg-orange-300/15 text-orange-200"
                            : "border-silver-200/20 bg-silver-100/[0.08] text-silver-300 hover:bg-silver-100/[0.12]"
                        }`}
                      >
                        {ticker.ticker}
                        {ticker.isPrimary && <span className="text-[9px]">★</span>}
                      </button>
                    ))}
                  </div>
                )}
                
                <p className="mt-4 line-clamp-3 max-w-3xl text-sm leading-relaxed text-silver-300">
                  {cleanExcerpt(featuredArticle.content, 260)}
                </p>
                <div className="mt-auto pt-6">
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-400 px-5 py-2.5 text-sm font-black text-[#1c130b] transition group-hover:bg-orange-300">
                    Baca Artikel <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-[30px] border border-silver-200/10 bg-[#071711]/60 p-8 text-center sm:rounded-[36px] sm:p-12">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-orange-300" />
            <h2 className="text-2xl font-black text-silver-100">Belum Ada Artikel</h2>
            <p className="mt-2 text-sm text-silver-300">Artikel harian akan muncul di sini setelah penutupan pasar.</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200">Artikel Lainnya</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Artikel Terbaru</h2>
            </div>
            <Link
              href="/admin?tab=articles"
              className="hidden text-xs font-bold text-silver-400 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded sm:inline"
            >
              Admin
            </Link>
          </div>

          {articlesLoading ? (
            [...Array(5)].map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-silver-200/[0.045]" />)
          ) : secondaryArticles.length > 0 ? (
            secondaryArticles.map((article) => (
              <Link
                href={`/articles/${article._id}`}
                key={article._id}
                className="group grid grid-cols-[78px_minmax(0,1fr)] gap-3 rounded-[22px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.62)] p-4 transition duration-300 hover:border-orange-300/35 hover:bg-[#0b2119]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-4 sm:rounded-[24px]"
              >
                <div className="overflow-hidden rounded-2xl">
                  <ArticleVisual article={article} />
                </div>
                <div className="min-w-0 py-1">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-silver-400">
                      {formatDate(article.createdAt, false)}
                    </p>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${getArticleKindClass(article)}`}>
                      {getArticleKind(article)}
                    </span>
                    {article.metadata?.sentiment && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold ${getSentimentColor(article.metadata.sentiment)}`}>
                        {getSentimentIcon(article.metadata.sentiment)}
                      </span>
                    )}
                    {article.metadata?.impactLevel && article.metadata.impactLevel !== "low" && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold ${getImpactColor(article.metadata.impactLevel)}`}>
                        {article.metadata.impactLevel === "high" ? "⚠" : "!"}
                      </span>
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-silver-100 group-hover:text-orange-200">
                    {article.title}
                  </h3>
                  
                  {/* Extracted Tickers Pills */}
                  {article.extractedTickers && article.extractedTickers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {article.extractedTickers.slice(0, 3).map((ticker) => (
                        <button
                          key={ticker.ticker}
                          onClick={(e) => {
                            e.preventDefault();
                            handleTickerFilter(ticker.ticker);
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition hover:scale-105 ${
                            ticker.isPrimary
                              ? "border-orange-300/30 bg-orange-300/15 text-orange-200"
                              : "border-silver-200/20 bg-silver-100/[0.08] text-silver-300"
                          }`}
                        >
                          {ticker.ticker}
                          {ticker.isPrimary && <span className="text-[8px]">★</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-silver-400">
                    {cleanExcerpt(article.content, 120)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-silver-200/10 bg-silver-200/[0.035] p-6 text-center text-sm text-silver-300">
              Artikel tambahan belum tersedia.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-200">Market Wire</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Berita Pilihan Hari Ini</h2>
          </div>
          <p className="max-w-md text-sm text-silver-300">
            Berita dari Detik, IPOT, CNBC Indonesia, dan Bisnis.com. Klik ticker yang terdeteksi untuk membuka grafik cepat.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {newsLoading
            ? [...Array(6)].map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-silver-200/[0.045]" />)
            : visibleNews.slice(0, 8).map((item, index) => (
              <NewsCard
                key={`${item.link || item.title}-wide-${index}`}
                item={item}
                onOpenTicker={(ticker, fullTicker) => setModalTicker({ ticker, fullTicker })}
              />
            ))}
        </div>
      </section>

      {modalTicker && (
        <StockQuickModal
          ticker={modalTicker.ticker}
          fullTicker={modalTicker.fullTicker}
          onClose={() => setModalTicker(null)}
        />
      )}
    </div>
  );
}


export default function InsightsPage() {
  return (
    <Suspense fallback={<div className="h-[600px]" />}>
      <InsightsPageContent />
    </Suspense>
  );
}
