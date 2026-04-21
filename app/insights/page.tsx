"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { TitleWithPills, StockQuickModal } from "@/components/ui/TickerPill";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  image?: string;
}

interface ArticleItem {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isPublic: boolean;
  authorId?: { name: string; email: string };
  createdAt: string;
}

export default function InsightsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [modalTicker, setModalTicker] = useState<{ ticker: string; fullTicker: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"articles" | "news">("articles");

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
        if (Array.isArray(data)) setArticles(data);
      } catch {
        console.error("Failed to fetch articles");
      } finally {
        setArticlesLoading(false);
      }
    };

    fetchNews();
    fetchArticles();
  }, []);

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-silver-100">Market Insights</h1>
        <p className="mt-2 text-silver-500">Analisis mendalam dan arus berita pasar modal pilihan.</p>
      </header>

      {/* Tab Switcher - Impeccable Style */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08] w-fit">
        <button
          onClick={() => setActiveTab("articles")}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "articles"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
              : "text-silver-500 hover:text-silver-300"
          }`}
        >
          Artikel Pilihan
        </button>
        <button
          onClick={() => setActiveTab("news")}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "news"
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
              : "text-silver-500 hover:text-silver-300"
          }`}
        >
          Berita Terkini
        </button>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === "articles" ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articlesLoading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-3xl bg-white/[0.03] border border-white/[0.05]" />
              ))
            ) : articles.length === 0 ? (
              <div className="col-span-full py-20 text-center text-silver-500">Tidak ada artikel ditemukan.</div>
            ) : (
              articles.map((article) => (
                <Link
                  href={`/articles/${article._id}`}
                  key={article._id}
                  className="group flex flex-col overflow-hidden rounded-[32px] border border-white/8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}
                >
                  <div className="relative h-48 w-full overflow-hidden bg-white/[0.02]">
                    {article.imageUrl ? (
                      <Image
                        src={article.imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-silver-800">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-silver-500">
                      <span>{new Date(article.createdAt).toLocaleDateString("id-ID", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="px-2 py-0.5 rounded-full border border-white/10">Editorial</span>
                    </div>
                    <h3 className="line-clamp-2 text-lg font-bold leading-tight text-silver-100 group-hover:text-orange-400 transition-colors">
                      {article.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-silver-500">
                      {article.content}
                    </p>
                    <div className="mt-auto pt-6 flex items-center gap-2 text-xs font-semibold text-orange-400/80">
                      <span>Read Insight</span>
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {newsLoading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))
            ) : (
              news.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-4 p-4 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all"
                >
                  {item.image && (
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-white/[0.02]">
                      <img src={item.image} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-orange-500/70 uppercase">{item.source}</span>
                      <span className="text-[10px] text-silver-600">•</span>
                      <span className="text-[10px] text-silver-600">{item.pubDate}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-silver-200 line-clamp-2 group-hover:text-silver-100 transition-colors">
                      <TitleWithPills text={item.title} onOpen={(t, ft) => setModalTicker({ ticker: t, fullTicker: ft })} />
                    </h4>
                  </div>
                </a>
              ))
            )}
          </div>
        )}
      </div>

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
