/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Radio,
  Rows3,
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
}

const DEFAULT_MARKET_NEWS: NewsItem[] = [
  {
    title: "Pantau rotasi sektor, IHSG, dan saham yang menjaga support setelah sesi penutupan",
    description:
      "News feed eksternal belum tersedia. Gunakan ringkasan ini sebagai pengingat membaca arah indeks, volume, dan reaksi saham pilihan.",
    pubDate: new Date().toISOString(),
    source: "Market Radar",
  },
  {
    title: "Fokus ke saham dengan volume sehat, close dekat high, dan risiko stop loss yang masih masuk akal",
    description:
      "Saat berita real-time kosong, workflow anomalisaham tetap mengutamakan price-volume dan rencana trading yang terukur.",
    pubDate: new Date().toISOString(),
    source: "Anomali Note",
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
  return isAutoArticle(article) ? "AI Article" : "Special Article";
}

function getArticleKindClass(article: ArticleItem) {
  return isAutoArticle(article)
    ? "border-orange-200/20 bg-orange-100/10 text-orange-200"
    : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";
}

function ArticleVisual({ article, featured = false }: { article: ArticleItem; featured?: boolean }) {
  if (article.imageUrl) {
    return (
      <img
        src={article.imageUrl}
        alt={article.title}
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
    <article className="group rounded-[22px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.58)] p-3.5 transition duration-300 hover:border-orange-400/35 hover:bg-[oklch(15%_0.024_150_/_0.82)] sm:rounded-[24px] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        {!compact && item.image ? (
          <div className="h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-silver-200/5 sm:h-20 sm:w-24 sm:rounded-xl">
            <img src={item.image} alt="" className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-silver-400">
            <span className="text-orange-300">{item.source}</span>
            <span className="text-silver-600">|</span>
            <span>{formatDate(item.pubDate, false)}</span>
          </div>
          <h3 className="text-[0.92rem] font-extrabold leading-snug text-silver-100 sm:text-sm">
            <TitleWithPills text={item.title} onOpen={onOpenTicker} />
          </h3>
          {!compact && item.description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-silver-400">{item.description}</p>
          ) : null}
          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-orange-300 transition hover:text-orange-200"
            >
              Buka sumber <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function InsightsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
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

    fetchNews();
    fetchArticles();
  }, []);

  const featuredArticle = articles[0];
  const secondaryArticles = articles.slice(1, 7);
  const visibleNews = useMemo(() => (news.length > 0 ? news : DEFAULT_MARKET_NEWS), [news]);
  const autoArticleCount = articles.filter(isAutoArticle).length;
  const manualArticleCount = articles.filter((article) => !isAutoArticle(article)).length;
  const ipotNewsCount = visibleNews.filter((item) => item.source.toLowerCase().includes("ipot")).length;

  return (
    <div className="dashboard-typography space-y-8 pb-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-[30px] border border-orange-200/10 bg-[oklch(14%_0.024_150_/_0.86)] shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:rounded-[44px]">
        <div
          className="absolute inset-0 opacity-95"
          style={{
            background:
              "radial-gradient(circle at 86% 8%, oklch(68% 0.13 68 / 0.24), transparent 30%), radial-gradient(circle at 12% 88%, oklch(50% 0.08 154 / 0.2), transparent 34%), linear-gradient(135deg, oklch(16% 0.024 150 / 0.96), oklch(10% 0.015 115 / 0.98))",
          }}
        />
        <div className="absolute left-5 top-5 h-24 w-24 rounded-full border border-orange-100/10 sm:left-8 sm:top-8 sm:h-32 sm:w-32" />
        <div className="absolute bottom-6 right-5 h-32 w-32 rounded-full border border-emerald-100/10 sm:bottom-8 sm:right-8 sm:h-44 sm:w-44" />
        <div className="relative grid gap-5 p-4 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)] lg:p-10">
          <div className="flex min-h-0 flex-col justify-between lg:min-h-[440px]">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/20 bg-orange-100/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-100 sm:text-[11px] sm:tracking-[0.22em]">
                  <Radio className="h-3.5 w-3.5" />
                  Insight Desk
                </span>
                <span className="rounded-full border border-silver-200/10 bg-silver-100/[0.06] px-3 py-1.5 text-xs font-semibold text-silver-300">
                  Detik + IPOT
                </span>
              </div>
              <h1 className="max-w-4xl text-[2.65rem] font-extrabold leading-[0.92] tracking-[-0.055em] text-[oklch(94%_0.02_96)] sm:text-6xl lg:text-7xl">
                Insight Desk untuk baca market tanpa kebanyakan noise.
              </h1>
              <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-[oklch(78%_0.025_105)] sm:mt-6 sm:text-base sm:leading-8">
                Special Article, AI Article 5 hari terakhir, dan market wire dari Detik serta IPOT dikumpulkan dalam satu halaman yang lebih rapi buat riset harian.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">
              {[
                { label: "Artikel", value: articlesLoading ? "..." : String(articles.length), icon: BookOpen },
                { label: "AI Article", value: articlesLoading ? "..." : String(autoArticleCount), icon: Radio },
                { label: "Special Article", value: articlesLoading ? "..." : String(manualArticleCount), icon: BookOpen },
                { label: "Auto close", value: "16:15 WIB", icon: CalendarDays },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[20px] border border-silver-200/10 bg-silver-100/[0.045] p-3 backdrop-blur-xl sm:rounded-[24px] sm:p-4">
                    <Icon className="mb-2 h-4 w-4 text-orange-300 sm:mb-3" />
                    <p className="text-xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-2xl">{item.value}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-silver-500 sm:text-[11px] sm:tracking-[0.16em]">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[26px] border border-silver-200/10 bg-[oklch(10%_0.016_145_/_0.72)] p-3.5 shadow-2xl backdrop-blur-xl sm:rounded-[32px] sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-orange-200">News sekarang</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-silver-100">Market wire</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                <Rows3 className="h-4 w-4" />
              </span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-silver-500">
              {newsLoading ? "Mengambil feed market..." : `${visibleNews.length} headline aktif, ${ipotNewsCount} dari IPOT.`}
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

      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        {articlesLoading ? (
          <div className="h-[420px] animate-pulse rounded-[30px] bg-silver-200/[0.045] sm:h-[560px] sm:rounded-[36px]" />
        ) : featuredArticle ? (
          <Link
            href={`/articles/${featuredArticle._id}`}
            className="group overflow-hidden rounded-[30px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.78)] shadow-[0_30px_90px_rgba(0,0,0,0.28)] transition duration-500 hover:-translate-y-1 hover:border-orange-300/35 sm:rounded-[36px]"
          >
            <div className="grid min-h-0 sm:min-h-[560px] lg:grid-rows-[320px_1fr]">
              <div className="h-56 overflow-hidden sm:h-auto">
                <ArticleVisual article={featuredArticle} featured />
              </div>
              <div className="flex flex-col p-5 sm:p-7">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-silver-500 sm:mb-4 sm:gap-3 sm:text-xs sm:tracking-[0.16em]">
                  <span>{formatDate(featuredArticle.createdAt, false)}</span>
                  <span className="text-silver-700">|</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] ${getArticleKindClass(featuredArticle)}`}>
                    {getArticleKind(featuredArticle)}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.04em] text-silver-100 sm:text-4xl">
                  {featuredArticle.title}
                </h2>
                <p className="mt-4 line-clamp-3 max-w-3xl text-sm leading-relaxed text-silver-400">
                  {cleanExcerpt(featuredArticle.content, 260)}
                </p>
                <div className="mt-auto pt-6">
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-400 px-4 py-2 text-sm font-black text-[#1c130b] transition group-hover:bg-orange-300">
                    Baca insight <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-[30px] border border-silver-200/10 bg-[#071711]/60 p-7 text-center sm:rounded-[36px] sm:p-10">
            <BookOpen className="mx-auto mb-4 h-8 w-8 text-orange-300" />
            <h2 className="text-2xl font-black text-silver-100">Belum ada artikel</h2>
            <p className="mt-2 text-sm text-silver-400">Artikel harian akan muncul di sini setelah cron penutupan pasar berjalan.</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-orange-200">Editorial queue</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Artikel terbaru</h2>
            </div>
            <Link href="/admin?tab=articles" className="hidden text-xs font-bold text-silver-400 hover:text-orange-300 sm:inline">
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
                className="group grid grid-cols-[78px_minmax(0,1fr)] gap-3 rounded-[22px] border border-silver-200/10 bg-[oklch(12%_0.02_150_/_0.62)] p-3 transition duration-300 hover:border-orange-300/35 hover:bg-[#0b2119]/75 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-4 sm:rounded-[24px]"
              >
                <div className="overflow-hidden rounded-2xl">
                  <ArticleVisual article={article} />
                </div>
                <div className="min-w-0 py-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-silver-500">
                      {formatDate(article.createdAt, false)}
                    </p>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] ${getArticleKindClass(article)}`}>
                      {getArticleKind(article)}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-silver-100 group-hover:text-orange-200">
                    {article.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-silver-500">
                    {cleanExcerpt(article.content, 120)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-silver-200/10 bg-silver-200/[0.035] p-6 text-sm text-silver-400">
              Artikel tambahan belum tersedia.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-orange-200">Market wire</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-silver-100 sm:text-3xl">Berita pilihan hari ini</h2>
          </div>
          <p className="max-w-md text-sm text-silver-500">
            Feed Detik dan IPOT tampil di halaman utama insights. Klik ticker yang terdeteksi untuk membuka chart cepat.
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
