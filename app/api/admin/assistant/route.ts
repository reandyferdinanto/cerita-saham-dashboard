import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { getAll as getWatchlist } from "@/lib/watchlistStore";
import { searchStocks } from "@/lib/yahooFinance";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Article from "@/lib/models/Article";
import { buildArticleExternalContext } from "@/lib/adminArticleContext";
import OpenAI from "openai";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_ARTICLE_MODEL || "llama-3.3-70b-versatile";

type AssistantIntent = "open_watchlist" | "create_article" | "list_articles" | "users" | "navigate" | "help";

type StockNewsItem = {
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  sentimentReason: string;
  pubDate: string;
};

function getGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  return apiKey;
}

function targetToHref(target: string, ticker?: string | null): string {
  const t = ticker?.toUpperCase().replace(/\.JK$/i, "");
  switch (target) {
    case "guidance":
      return "/guidance";
    case "members":
      return "/admin?tab=members";
    case "articles_admin":
      return "/admin?tab=articles";
    case "stock_summary":
      return t ? `/admin?tab=stock-summary&ticker=${t}` : "/admin?tab=stock-summary";
    case "search":
      return t ? `/search?q=${t}` : "/search";
    case "insights":
      return t ? `/insights?q=${t}` : "/insights";
    case "dashboard":
      return "/";
    case "watchlist":
      return "/watchlist";
    case "investor_tools":
      return "/investor-tools";
    case "simulation":
      return "/simulation";
    case "research":
      return "/research";
    default:
      return "/";
  }
}

function detectIntent(message: string): AssistantIntent {
  const lower = message.toLowerCase();

  if (/(ada artikel|artikel apa|artikel apa saja|daftar artikel|list artikel)/.test(lower)) {
    return "list_articles";
  }

  if (/(artik|tulis|buatkan|buat|draft)/.test(lower) && /(tentang|soal|mengenai|pasar|saham|ihsg|kondisi)/.test(lower)) {
    return "create_article";
  }

  if (/(watchlist|tp\/sl|bandarmology)/.test(lower)) {
    return "open_watchlist";
  }

  if (/(user|member|join|baru daftar|baru join|new join|registrasi terbaru|aktif|pending|expired|suspend|ditolak)/.test(lower)) {
    return "users";
  }

  return "help";
}

function detectUserFilter(message: string) {
  const lower = message.toLowerCase();

  if (/(aktif|active)/.test(lower)) return "active";
  if (/(pending|menunggu)/.test(lower)) return "pending";
  if (/(expired|kadaluarsa|deactivate|nonaktif)/.test(lower)) return "expired";
  if (/(rejected|ditolak)/.test(lower)) return "rejected";
  if (/(suspend|suspended)/.test(lower)) return "suspended";

  return "newest";
}

function extractTopic(message: string) {
  const match = message.match(/(?:tentang|soal|mengenai)\s+(.+)$/i);

  if (match?.[1]) {
    return match[1].trim();
  }

  return message
    .replace(/buatkan artikel|buat artikel|tulis artikel|buat draft artikel/gi, "")
    .trim();
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fencedMatch?.[1]) {
    return parseJsonObject(fencedMatch[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI response did not contain JSON");
  }

  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

async function requestGroq(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqKey()}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.4,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${errorText}`);
  }

  const json = await response.json();
  const contentText = json.choices?.[0]?.message?.content;

  if (typeof contentText !== "string") {
    throw new Error("Groq returned an unexpected payload");
  }

  return contentText;
}

async function groqJsonCompletion(systemPrompt: string, userPrompt: string) {
  const baseMessages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const firstResponse = await requestGroq(baseMessages);

  try {
    return parseJsonObject(firstResponse);
  } catch {
    const retryResponse = await requestGroq([
      ...baseMessages,
      { role: "assistant", content: firstResponse },
      {
        role: "user",
        content:
          'Ulangi jawaban hanya dalam JSON valid tanpa penjelasan tambahan, tanpa markdown, tanpa code fence. Gunakan format {"reply":"...","title":"...","content":"...","brief":"..."}.',
      },
    ]);

    return parseJsonObject(retryResponse);
  }
}

function buildNewsSummary(news: StockNewsItem[]) {
  if (news.length === 0) {
    return "Belum ada news sentiment spesifik yang berhasil diambil untuk topik ini.";
  }

  const counts = {
    positive: news.filter((item) => item.sentiment === "positive").length,
    negative: news.filter((item) => item.sentiment === "negative").length,
    neutral: news.filter((item) => item.sentiment === "neutral").length,
  };

  const highlights = news.slice(0, 3).map((item) => {
    return `- ${item.title} (${item.sentiment}, alasan: ${item.sentimentReason})`;
  });

  return [
    `Sentimen news: ${counts.positive} positif, ${counts.negative} negatif, ${counts.neutral} netral.`,
    ...highlights,
  ].join("\n");
}

async function generateArticleDraft(
  topic: string,
  stockContext: { symbol?: string; name?: string },
  news: StockNewsItem[],
  externalContext?: { quoteSummary?: string; technicalSummary?: string; newsSummary?: string }
) {
  const systemPrompt = [
    "Anda adalah asisten editorial untuk admin anomalisaham.",
    "Tulis draft artikel berbahasa Indonesia yang rapi, mudah dibaca, dan siap diedit admin.",
    "Gunakan paragraf pendek dan bullet list bila ada beberapa poin penting.",
    "Jika ada sentimen news, rangkum secara hati-hati tanpa melebih-lebihkan.",
    "Jika ada harga saat ini atau analisa teknikal, gunakan seperlunya untuk memperkuat konteks artikel.",
    "Jangan mengarang fakta di luar konteks yang diberikan.",
    'Kembalikan JSON valid dengan properti: reply, title, content, brief.',
  ].join(" ");

  const newsBlock =
    news.length === 0
      ? "Tidak ada berita ticker spesifik yang berhasil diambil."
      : news
          .slice(0, 5)
          .map(
            (item, index) =>
              `${index + 1}. ${item.title} | sentimen=${item.sentiment} | skor=${item.sentimentScore} | alasan=${item.sentimentReason}`
          )
          .join("\n");

  const userPrompt = [
    `Topik artikel: ${topic}`,
    `Konteks saham: ${stockContext.symbol || "-"} ${stockContext.name || ""}`.trim(),
    `Ringkasan news:\n${newsBlock}`,
    externalContext?.quoteSummary ? `Harga saat ini:\n${externalContext.quoteSummary}` : "",
    externalContext?.technicalSummary ? `Analisa teknikal:\n${externalContext.technicalSummary}` : "",
    externalContext?.newsSummary ? `Informasi tambahan relevan:\n${externalContext.newsSummary}` : "",
    "Buat artikel dengan format: pembuka singkat, poin sentimen/hal yang perlu dicermati, lalu penutup singkat.",
    "Jika tidak ada news, tetap buat artikel pengantar yang netral dan jelaskan bahwa admin perlu melengkapi data terbaru.",
  ].join("\n\n");

  const parsed = await groqJsonCompletion(systemPrompt, userPrompt);

  return {
    reply:
      typeof parsed.reply === "string"
        ? parsed.reply.trim()
        : `Saya sudah menyiapkan draft artikel untuk topik ${topic}.`,
    title: typeof parsed.title === "string" ? parsed.title.trim() : `Draft Artikel ${topic}`,
    content: typeof parsed.content === "string" ? parsed.content.trim() : "",
    brief: typeof parsed.brief === "string" ? parsed.brief.trim() : "",
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { message?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const intent = detectIntent(message);

    if (intent === "open_watchlist") {
      const watchlist = await getWatchlist();
      const preview = watchlist.slice(0, 5).map((entry) => `${entry.ticker.replace(".JK", "")} (${entry.name})`);

      return NextResponse.json({
        intent,
        reply:
          watchlist.length > 0
            ? `Saya buka manajemen watchlist. Saat ini ada ${watchlist.length} saham dipantau: ${preview.join(", ")}.`
            : "Saya buka manajemen watchlist. Saat ini watchlist masih kosong.",
        action: { type: "navigate", href: "/admin" },
        preview,
      });
    }

    if (intent === "users") {
      await connectDB();
      const filter = detectUserFilter(message);
      const query =
        filter === "newest"
          ? { role: { $ne: "superadmin" } }
          : { role: { $ne: "superadmin" }, membershipStatus: filter };

      const listedUsers = await User.find(
        query,
        { email: 1, name: 1, createdAt: 1, membershipStatus: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      return NextResponse.json({
        intent,
        reply:
          listedUsers.length > 0
            ? filter === "newest"
              ? `Saya buka halaman user dan menyiapkan daftar ${listedUsers.length} user terbaru. User paling baru: ${listedUsers
                  .slice(0, 3)
                  .map((user) => user.name || user.email)
                  .join(", ")}.`
              : `Saya buka halaman user dengan filter ${filter}. Ditemukan ${listedUsers.length} user, contoh: ${listedUsers
                  .slice(0, 3)
                  .map((user) => user.name || user.email)
                  .join(", ")}.`
            : filter === "newest"
              ? "Saya buka halaman user, tetapi belum ada user yang ditemukan."
              : `Saya buka halaman user dengan filter ${filter}, tetapi belum ada user yang cocok.`,
        action: {
          type: "navigate",
          href: filter === "newest" ? "/admin?tab=members&view=newest" : `/admin?tab=members&status=${filter}`,
        },
        recentUsers: listedUsers.map((user) => ({
          _id: String(user._id),
          email: user.email,
          name: user.name || "",
          membershipStatus: user.membershipStatus,
          createdAt: user.createdAt,
        })),
      });
    }

    if (intent === "list_articles") {
      await connectDB();
      const articles = await Article.find({}, { title: 1, createdAt: 1, isPublic: 1 })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

      return NextResponse.json({
        intent,
        reply:
          articles.length > 0
            ? `Saya buka manajemen artikel. Saat ini ada ${articles.length} artikel terbaru: ${articles
                .slice(0, 3)
                .map((article) => article.title)
                .join(", ")}.`
            : "Saya buka manajemen artikel, tetapi belum ada artikel yang tersimpan.",
        action: { type: "navigate", href: "/admin?tab=articles" },
        articles: articles.map((article) => ({
          _id: String(article._id),
          title: article.title,
          createdAt: article.createdAt,
          isPublic: article.isPublic,
        })),
      });
    }

    if (intent === "create_article") {
      const topic = extractTopic(message) || "topik baru";
      const searchResults = await searchStocks(topic);
      const exactMatch =
        searchResults.find((item) => item.symbol.replace(".JK", "").toLowerCase() === topic.toLowerCase()) ||
        searchResults.find((item) => item.name.toLowerCase().includes(topic.toLowerCase())) ||
        searchResults[0];

      const externalContext = await buildArticleExternalContext(req.nextUrl.origin, topic);
      const news = externalContext.relevantNews as StockNewsItem[];
      const draft = await generateArticleDraft(
        topic,
        exactMatch ? { symbol: exactMatch.symbol, name: exactMatch.name } : {},
        news,
        externalContext
      );

      return NextResponse.json({
        intent,
        reply: `${draft.reply}\n\n${[
          externalContext.quoteSummary,
          externalContext.technicalSummary,
          buildNewsSummary(news),
        ]
          .filter(Boolean)
          .join("\n\n")}`,
        action: { type: "navigate", href: "/admin?tab=articles&assistant=draft" },
        articleDraft: {
          title: draft.title,
          content: draft.content,
          brief:
            draft.brief ||
            [externalContext.quoteSummary, externalContext.technicalSummary, buildNewsSummary(news)]
              .filter(Boolean)
              .join("\n\n"),
          topic,
          stockSymbol: externalContext.stockSymbol || exactMatch?.symbol || "",
          stockName: externalContext.stockName || exactMatch?.name || "",
          newsSummary: [externalContext.newsSummary, buildNewsSummary(news)].filter(Boolean).join("\n"),
        },
      });
    }

    if (intent === "help") {
      // AI-powered intent classifier: navigation OR chat
      const nvidiaKey = process.env.NVIDIA_API_KEY;
      if (!nvidiaKey) {
        return NextResponse.json({
          intent,
          reply:
            "Saya bisa bantu buka watchlist, menyiapkan draft artikel, menampilkan artikel terbaru, atau memfilter user. Coba: 'buka watchlist', 'buatkan artikel tentang kondisi pasar saat ini', 'ada artikel apa saja', atau 'lihat user aktif'.",
        });
      }

      const nvidia = new OpenAI({
        apiKey: nvidiaKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });

      // STEP 1: Use AI as a router to detect navigation intent + ticker
      const routerSystemPrompt = [
        "Kamu adalah router untuk Admin Copilot anomalisaham. Klasifikasi pesan user dan kembalikan HANYA JSON valid (tanpa markdown, tanpa code fence, tanpa penjelasan).",
        "",
        "Available routes:",
        '- "guidance" → halaman panduan / help / cara pakai',
        '- "members" → admin manage members (approve user, lihat user, member terbaru)',
        '- "articles_admin" → admin manage articles',
        '- "stock_summary" → analisa akumulasi / bandar / saham siap jalan / stock summary harian',
        '- "search" → halaman riset saham (chart, news, fundamental, technical signal)',
        '- "insights" → halaman insight desk (artikel + berita pasar)',
        '- "dashboard" → dashboard utama IHSG',
        '- "watchlist" → halaman watchlist (member view)',
        '- "investor_tools" → tools (risk calculator, AI brief, right issue, stock split)',
        '- "simulation" → simulasi trading edukatif (avg down, pyramiding)',
        '- "research" → halaman research bandar/smart money/backtest (admin only)',
        '- "chat" → tidak ada navigasi, jawab via AI chat',
        "",
        'Format JSON wajib: {"action":"navigate"|"chat","target":"<route_name>"|null,"ticker":"<KODE>"|null,"reply":"<1 kalimat bahasa Indonesia>"}',
        "",
        "Contoh:",
        '"buka panduan" → {"action":"navigate","target":"guidance","ticker":null,"reply":"Oke, membuka halaman panduan."}',
        '"dimana approve member" → {"action":"navigate","target":"members","ticker":null,"reply":"Membuka halaman approve member."}',
        '"saya mau analisa saham coal" → {"action":"navigate","target":"search","ticker":"COAL","reply":"Membuka halaman riset saham COAL."}',
        '"apakah saham gula ada akumulasi?" → {"action":"navigate","target":"stock_summary","ticker":"GULA","reply":"Membuka halaman analisa akumulasi untuk cek GULA."}',
        '"adakah berita tentang kblf" → {"action":"navigate","target":"insights","ticker":"KLBF","reply":"Membuka halaman insight untuk berita KLBF."}',
        '"buka risk calculator" → {"action":"navigate","target":"investor_tools","ticker":null,"reply":"Membuka investor tools."}',
        '"apa itu pocket pivot?" → {"action":"chat","target":null,"ticker":null,"reply":""}',
        '"halo" → {"action":"chat","target":null,"ticker":null,"reply":""}',
        "",
        "Catatan:",
        "- Ticker IDX umumnya 3-4 huruf kapital (BBCA, KLBF, INET, COAL, GULA, GOTO, BMRI)",
        "- Jika user salah ketik (kblf → KLBF), perbaiki ke kode IDX standar",
        "- Pertanyaan teori, definisi, strategi, analisa konsep tanpa ticker → chat",
        "- Sapaan / chit-chat → chat",
      ].join("\n");

      let navigation: {
        action: "navigate" | "chat";
        target: string | null;
        ticker: string | null;
        reply: string;
      } = { action: "chat", target: null, ticker: null, reply: "" };

      try {
        const routerCompletion = await nvidia.chat.completions.create({
          model: process.env.NVIDIA_MODEL || "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: routerSystemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.1,
          top_p: 1,
          max_tokens: 256,
        });

        const raw = routerCompletion.choices[0]?.message?.content?.trim() || "{}";
        navigation = parseJsonObject(raw);
      } catch (routerErr) {
        console.error("Navigation router failed:", routerErr);
      }

      // STEP 2: If navigation detected, return navigate action
      if (navigation.action === "navigate" && navigation.target) {
        const ticker = navigation.ticker?.toUpperCase().replace(/\.JK$/i, "");
        const href = targetToHref(navigation.target, ticker);
        return NextResponse.json({
          intent: "navigate",
          reply: navigation.reply || "Sedang membuka halaman.",
          action: { type: "navigate", href },
        });
      }

      // STEP 3: Fall back to general AI chat
      const completion = await nvidia.chat.completions.create({
        model: process.env.NVIDIA_MODEL || "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: [
              "Kamu adalah Admin Copilot untuk platform anomalisaham — dashboard analisis saham IDX.",
              "Jawab dalam bahasa Indonesia yang ringkas dan to-the-point.",
              "Kamu bisa membantu admin dengan: analisis saham, penjelasan teknikal, strategi trading, bandarmology, dan operasional platform.",
              "Jika admin bertanya tentang navigasi (buka watchlist, buat artikel, lihat user), sarankan perintah yang tepat.",
              "Jangan mengarang data harga atau angka spesifik yang tidak diberikan.",
            ].join(" "),
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 1024,
      });

      const aiReply = completion.choices[0]?.message?.content?.trim() || "Maaf, saya tidak bisa memproses permintaan ini.";

      return NextResponse.json({
        intent,
        reply: aiReply,
      });
    }

    return NextResponse.json({
      intent,
      reply:
        "Saya bisa bantu buka watchlist, menyiapkan draft artikel, menampilkan artikel terbaru, atau memfilter user. Coba: 'buka watchlist', 'buatkan artikel tentang kondisi pasar saat ini', 'ada artikel apa saja', atau 'lihat user aktif'.",
    });
  } catch (error) {
    console.error("Admin assistant error:", error);

    const message =
      error instanceof Error && error.message === "GROQ_API_KEY is not configured"
        ? "GROQ_API_KEY belum dikonfigurasi"
        : error instanceof Error && error.message.includes("NVIDIA")
          ? "NVIDIA API gagal — cek API key"
          : "Asisten admin gagal memproses permintaan";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
