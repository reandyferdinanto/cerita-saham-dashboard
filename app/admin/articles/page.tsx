"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";

interface Article {
  _id: string;
  title: string;
  content: string;
  imageUrl?: string;
  isPublic: boolean;
  authorId?: { name: string; email: string };
  createdAt: string;
}

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<AdminArticlesPageFallback />}>
      <AdminArticlesPageContent />
    </Suspense>
  );
}

export function AdminArticlesPageContent({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingList, setRefreshingList] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editorMode, setEditorMode] = useState<"manual" | "ai">("manual");
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState<"expand" | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    imageUrl: "",
    isPublic: false,
  });

  const fetchArticles = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (silent) {
      setRefreshingList(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/admin/articles", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      if (silent) {
        setRefreshingList(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (searchParams.get("assistant") !== "draft") {
      return;
    }

    const raw = sessionStorage.getItem("admin_assistant_article_draft");

    if (!raw) {
      return;
    }

    try {
      const draft = JSON.parse(raw) as {
        title?: string;
        content?: string;
        brief?: string;
        topic?: string;
        stockSymbol?: string;
        stockName?: string;
        newsSummary?: string;
      };

      setForm((current) => ({
        ...current,
        title: draft.title || current.title,
        content: draft.content || current.content,
      }));
      setAiBrief(draft.brief || draft.newsSummary || currentBriefFromDraft(draft));
      setAiMessage(`Draft artikel dari Admin Copilot sudah dimuat${draft.topic ? ` untuk topik ${draft.topic}` : ""}.`);
      setEditorMode("ai");
      sessionStorage.removeItem("admin_assistant_article_draft");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      sessionStorage.removeItem("admin_assistant_article_draft");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;

    try {
      const url = editingArticle ? `/api/admin/articles/${editingArticle._id}` : "/api/admin/articles";
      const method = editingArticle ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm({ title: "", content: "", imageUrl: "", isPublic: false });
        setEditingArticle(null);
        setAiBrief("");
        setAiError("");
        setAiMessage("");
        setEditorMode("manual");
        fetchArticles();
      }
    } catch (error) {
      console.error("Error saving article:", error);
    }
  };

  const handleExpandArticleWithAi = async () => {
    setAiLoading("expand");
    setAiError("");
    setAiMessage("");

    try {
      const res = await fetch("/api/admin/articles/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expand",
          title: form.title,
          content: form.content,
          instructions: aiBrief,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengembangkan artikel");
      }

      setForm((current) => ({
        ...current,
        title: data.title || current.title,
        content: data.content || current.content,
      }));

      setAiMessage("Draft artikel berhasil dikembangkan oleh AI.");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Gagal mengembangkan artikel");
    } finally {
      setAiLoading(null);
    }
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setForm({
      title: article.title,
      content: article.content,
      imageUrl: article.imageUrl || "",
      isPublic: article.isPublic,
    });
    setAiError("");
    setAiMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus artikel ini?")) return;
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (res.ok) {
        await fetchArticles({ silent: true });
      }
    } catch (error) {
      console.error("Error deleting article:", error);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <h1 className="text-3xl font-bold text-silver-100">
            Artikel <span className="text-orange-400">Panel</span>
          </h1>
          <p className="text-silver-500 text-sm mt-1">
            Kelola artikel yang akan ditampilkan di halaman utama
          </p>
        </div>
      ) : null}

      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-silver-200">
            {editingArticle ? "Edit Artikel" : "Tambah Artikel Baru"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: "rgba(15,23,42,0.55)", border: "1px solid rgba(251,146,60,0.2)" }}
          >
            <div>
              <h3 className="text-sm font-semibold text-silver-200">Mode Penulisan</h3>
              <p className="text-xs text-silver-500 mt-1">
                Pilih manual jika ingin menulis sendiri, atau gunakan AI untuk mengembangkan draft artikel berita dengan struktur pembukaan, inti, dan kesimpulan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditorMode("manual")}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: editorMode === "manual" ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.04)",
                  color: editorMode === "manual" ? "#86efac" : "#94a3b8",
                  border: editorMode === "manual" ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(226,232,240,0.08)",
                }}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("ai")}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: editorMode === "ai" ? "rgba(251,146,60,0.16)" : "rgba(255,255,255,0.04)",
                  color: editorMode === "ai" ? "#fdba74" : "#94a3b8",
                  border: editorMode === "ai" ? "1px solid rgba(251,146,60,0.35)" : "1px solid rgba(226,232,240,0.08)",
                }}
              >
                Kembangkan dengan AI
              </button>
            </div>
            {editorMode === "ai" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-silver-500 uppercase block mb-1">Brief untuk AI</label>
                  <textarea
                    rows={4}
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    className="glass-input w-full px-3 py-2 text-sm text-silver-200"
                    placeholder="Contoh: Buat artikel berita tentang emiten BEI dengan pembukaan singkat, inti yang menjelaskan sentimen pasar dan katalis utama, lalu penutup yang merangkum hal yang perlu dicermati investor."
                  />
                  <p className="text-[11px] text-silver-500 mt-2">
                    AI hanya memakai konteks yang relevan dengan Bursa Efek Indonesia, IDX, IHSG, dan emiten Indonesia.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExpandArticleWithAi}
                    disabled={aiLoading !== null}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                    style={{ background: "rgba(251,146,60,0.16)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.35)" }}
                  >
                    {aiLoading === "expand" ? "Mengembangkan..." : "Kembangkan Draft dengan AI"}
                  </button>
                </div>
                {aiError ? <p className="text-sm text-red-400">{aiError}</p> : null}
                {aiMessage ? <p className="text-sm text-emerald-300">{aiMessage}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-silver-500">
                Mode manual aktif. Form judul dan konten di bawah akan disimpan apa adanya.
              </p>
            )}
          </div>
          <div>
            <label className="text-[10px] text-silver-500 uppercase block mb-1">Judul Artikel</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="glass-input w-full px-3 py-2 text-sm text-silver-200"
              placeholder="Contoh: Analisis IHSG Hari Ini"
            />
          </div>
          <div>
            <label className="text-[10px] text-silver-500 uppercase block mb-1">URL Gambar (Opsional)</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="glass-input w-full px-3 py-2 text-sm text-silver-200"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-[10px] text-silver-500 uppercase block mb-1">Konten (Teks dengan paragraf)</label>
            <textarea
              required
              rows={6}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="glass-input w-full px-3 py-2 text-sm text-silver-200"
              placeholder="Tulis artikel di sini. Baris baru akan menjadi paragraf baru..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="w-4 h-4 rounded border-silver-600 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="isPublic" className="text-sm text-silver-200 cursor-pointer">
              Artikel Publik (Bisa dilihat tanpa login)
            </label>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,#ea580c,#fb923c)", color: "#fff" }}
            >
              {editingArticle ? "Simpan Perubahan" : "Tambah Artikel"}
            </button>
            {editingArticle && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setForm({ title: "", content: "", imageUrl: "", isPublic: false });
                  setAiBrief("");
                  setAiError("");
                  setAiMessage("");
                  setEditorMode("manual");
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-silver-400 bg-silver-800"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </GlassCard>

      <GlassCard hover={false}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-silver-200">Daftar Artikel ({articles.length})</h2>
          {refreshingList ? (
            <span className="text-xs text-silver-500">Menyegarkan daftar...</span>
          ) : null}
        </div>
        {loading ? (
          <div className="text-silver-500 text-sm">Loading...</div>
        ) : articles.length === 0 ? (
          <div className="text-silver-500 text-sm py-4">Belum ada artikel.</div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div key={article._id} className="p-4 rounded-xl" style={{ background: "rgba(6,78,59,0.15)", border: "1px solid rgba(226,232,240,0.06)" }}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-silver-200">{article.title}</h3>
                    <div className="flex gap-3 text-[10px] uppercase text-silver-500 mt-1">
                      <span>{new Date(article.createdAt).toLocaleDateString("id-ID")}</span>
                      {article.isPublic ? (
                        <span className="text-green-500">Publik</span>
                      ) : (
                        <span className="text-orange-400">Privat (Login Required)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(article)}
                      className="px-2 py-1 text-xs text-silver-400 hover:text-orange-400 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(article._id)}
                      className="px-2 py-1 text-xs text-silver-400 hover:text-red-400 transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function AdminArticlesPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function currentBriefFromDraft(draft: { stockSymbol?: string; stockName?: string; topic?: string }) {
  const parts = [draft.topic, draft.stockSymbol, draft.stockName].filter(Boolean);
  return parts.length > 0 ? `Gunakan konteks topik ini: ${parts.join(" / ")}` : "";
}
