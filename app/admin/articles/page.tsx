"use client";

import { useEffect, useState, useCallback } from "react";
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
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState<"optimize" | null>(null);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    imageUrl: "",
    isPublic: false,
  });

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/articles");
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
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
        fetchArticles();
      }
    } catch (error) {
      console.error("Error saving article:", error);
    }
  };

  const handleOptimizeArticle = async () => {
    setAiLoading("optimize");
    setAiError("");
    setAiMessage("");

    try {
      const res = await fetch("/api/admin/articles/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "optimize",
          title: form.title,
          content: form.content,
          instructions: aiBrief,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengoptimalkan artikel");
      }

      setForm((current) => ({
        ...current,
        title: data.title || current.title,
        content: data.content || current.content,
      }));

      setAiMessage("Draft artikel diperbarui oleh AI.");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Gagal mengoptimalkan artikel");
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
      const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchArticles();
      }
    } catch (error) {
      console.error("Error deleting article:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-silver-100">
          Artikel <span className="text-orange-400">Panel</span>
        </h1>
        <p className="text-silver-500 text-sm mt-1">
          Kelola artikel yang akan ditampilkan di halaman utama
        </p>
      </div>

      <GlassCard hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-silver-200">
            {editingArticle ? "Edit Artikel" : "Tambah Artikel Baru"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(15,23,42,0.55)", border: "1px solid rgba(251,146,60,0.2)" }}
          >
            <div>
              <h3 className="text-sm font-semibold text-silver-200">AI Helper</h3>
              <p className="text-xs text-silver-500 mt-1">
                Gunakan Groq untuk merapikan struktur artikel agar paragraf, bullet, spacing, dan alur tulisannya lebih mudah dibaca.
              </p>
            </div>
            <div>
              <label className="text-[10px] text-silver-500 uppercase block mb-1">Brief untuk AI</label>
              <textarea
                rows={3}
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm text-silver-200"
                placeholder="Contoh: Rapikan menjadi artikel edukatif untuk investor pemula, fokus pada risiko dan langkah praktis."
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleOptimizeArticle}
                disabled={aiLoading !== null}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: "rgba(251,146,60,0.16)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.35)" }}
              >
                {aiLoading === "optimize" ? "Mengoptimalkan..." : "Optimalkan Artikel"}
              </button>
            </div>
            {aiError ? <p className="text-sm text-red-400">{aiError}</p> : null}
            {aiMessage ? <p className="text-sm text-emerald-300">{aiMessage}</p> : null}
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-silver-200">Daftar Artikel ({articles.length})</h2>
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

function currentBriefFromDraft(draft: { stockSymbol?: string; stockName?: string; topic?: string }) {
  const parts = [draft.topic, draft.stockSymbol, draft.stockName].filter(Boolean);
  return parts.length > 0 ? `Gunakan konteks topik ini: ${parts.join(" / ")}` : "";
}
