"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { useRouter } from "next/navigation";

interface Article {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isPublic: boolean;
  authorId?: { name: string; email: string };
  createdAt: string;
}

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(`/api/articles/${id}`);
        if (!res.ok) {
          if (res.status === 401) {
            setError("unauthorized");
          } else {
            setError("not_found");
          }
          return;
        }
        const data = await res.json();
        setArticle(data);
      } catch (err) {
        setError("error");
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-t-orange-400 border-orange-400/20" />
      </div>
    );
  }

  if (error === "unauthorized") {
    return (
      <GlassCard className="text-center py-20">
        <h2 className="text-2xl font-bold text-silver-100 mb-4">Artikel Ini Bersifat Privat</h2>
        <p className="text-silver-400 mb-6">Anda harus masuk ke akun Anda untuk membaca artikel ini.</p>
        <Link 
          href="/login"
          className="px-6 py-2.5 rounded-xl font-semibold transition-all inline-block"
          style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}
        >
          Masuk Sekarang
        </Link>
      </GlassCard>
    );
  }

  if (error || !article) {
    return (
      <GlassCard className="text-center py-20">
        <h2 className="text-2xl font-bold text-silver-100 mb-4">Artikel Tidak Ditemukan</h2>
        <Link href="/" className="text-orange-400 hover:underline">
          Kembali ke Beranda
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/" className="text-silver-400 hover:text-orange-400 text-sm flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Kembali
      </Link>
      <GlassCard className="p-6 md:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 text-xs text-silver-400 mb-3">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(article.createdAt).toLocaleDateString("id-ID", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </span>
            {article.authorId?.name && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {article.authorId.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-silver-100 leading-tight mb-4">
            {article.title}
          </h1>
          {article.imageUrl && (
            <div className="rounded-xl overflow-hidden mt-6 mb-8 w-full max-h-[500px]" style={{ background: "rgba(6,78,59,0.3)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={article.imageUrl} 
                alt={article.title} 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
        </div>
        
        <div className="prose prose-invert max-w-none text-silver-300">
          {article.content.split('\n').map((paragraph, idx) => (
            paragraph.trim() !== "" ? (
              <p key={idx} className="mb-4 leading-relaxed whitespace-pre-wrap text-base">
                {paragraph}
              </p>
            ) : null
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
