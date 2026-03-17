import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { buildArticleExternalContext } from "@/lib/adminArticleContext";

const GROQ_API_URL = "https://api.groq.com/openai/v1";
const ARTICLE_MODEL = process.env.GROQ_ARTICLE_MODEL || "llama-3.3-70b-versatile";

type OptimizeRequest = {
  action: "optimize";
  title?: string;
  content?: string;
  instructions?: string;
};

type OptimizedArticle = {
  title?: unknown;
  content?: unknown;
};

type MarketSections = {
  intro?: string;
  gainersIntro?: string;
  gainers: string[];
  losersIntro?: string;
  losers: string[];
  newsIntro?: string;
  news: string[];
  closingNote?: string;
};

function getGroqKey() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  return apiKey;
}

function sanitizeJsonString(raw: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        result += "\\n";
        continue;
      }

      if (char === "\r") {
        result += "\\r";
        continue;
      }

      if (char === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += char;
  }

  return result;
}

function extractJsonField(raw: string, field: "title" | "content") {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*})`, "i");
  const match = raw.match(pattern);

  if (!match?.[1]) {
    return "";
  }

  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .trim();
}

function parsePossiblyBrokenJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const sanitized = sanitizeJsonString(raw);

    try {
      return JSON.parse(sanitized);
    } catch {
      const title = extractJsonField(sanitized, "title");
      const content = extractJsonField(sanitized, "content");

      if (title || content) {
        return { title, content };
      }

      throw new Error("AI response did not contain valid JSON");
    }
  }
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parsePossiblyBrokenJson(trimmed);
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

  return parsePossiblyBrokenJson(trimmed.slice(firstBrace, lastBrace + 1));
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanBulletValue(line: string) {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoParagraphs(text: string) {
  return normalizeWhitespace(text)
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractMarketSections(text: string): MarketSections {
  const normalized = normalizeWhitespace(text);
  const paragraphs = splitIntoParagraphs(normalized);
  const sections: MarketSections = { gainers: [], losers: [], news: [] };

  let mode: "intro" | "gainers" | "losers" | "news" | "closing" = "intro";

  for (const paragraph of paragraphs) {
    const lower = paragraph.toLowerCase();
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);

    if (/top gainers|saham penguat|memimpin penguatan indeks/.test(lower)) {
      mode = "gainers";
      sections.gainersIntro = paragraph.replace(/^#{1,6}\s*/g, "");
      for (const line of lines) {
        if (/^[-*]\s+/.test(line)) {
          sections.gainers.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (/top losers|saham penekan|penekan indeks|pemberat indeks|koreksi paling dalam/.test(lower)) {
      mode = "losers";
      sections.losersIntro = paragraph.replace(/^#{1,6}\s*/g, "");
      for (const line of lines) {
        if (/^[-*]\s+/.test(line)) {
          sections.losers.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (/berita pasar|mewarnai hari ini|sentimen pasar/.test(lower)) {
      mode = "news";
      sections.newsIntro = paragraph.replace(/^#{1,6}\s*/g, "");
      for (const line of lines) {
        if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
          sections.news.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (/catatan:|laporan harian ini di-generate|laporan harian ini dihasilkan/i.test(paragraph)) {
      mode = "closing";
      sections.closingNote = paragraph.replace(/^catatan:\s*/i, "").trim();
      continue;
    }

    if (mode === "gainers") {
      for (const line of lines) {
        if (/^[-*]\s+/.test(line)) {
          sections.gainers.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (mode === "losers") {
      for (const line of lines) {
        if (/^[-*]\s+/.test(line)) {
          sections.losers.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (mode === "news") {
      for (const line of lines) {
        if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
          sections.news.push(cleanBulletValue(line));
        }
      }
      continue;
    }

    if (!sections.intro) {
      sections.intro = paragraph;
    } else if (!sections.closingNote && /16:15 WIB|otomatis|bot cerita saham/i.test(paragraph)) {
      sections.closingNote = paragraph;
    } else {
      sections.intro += `\n\n${paragraph}`;
    }
  }

  if (sections.news.some((item) => item.includes('"'))) {
    sections.news = sections.news.map((item) => item.replace(/^"|"$/g, "").trim());
  }

  return sections;
}

function fallbackFormat(text: string) {
  let next = normalizeWhitespace(text);
  next = next.replace(/:\s*-\s+/g, ":\n\n- ");
  next = next.replace(/,\s*-\s+/g, "\n- ");
  next = next.replace(/;\s*-\s+/g, "\n- ");
  next = next.replace(/\.\s*-\s+/g, ".\n\n- ");
  next = next.replace(/(Beberapa berita pasar yang mewarnai hari ini antara lain:)/gi, "$1\n\n");
  next = next.replace(/(Beberapa saham kapitalisasi besar yang memimpin penguatan indeks antara lain:)/gi, "$1\n\n");
  next = next.replace(/(beberapa saham yang menjadi penekan indeks karena mengalami koreksi paling dalam antara lain:)/gi, "$1\n\n");
  next = next.replace(/(Laporan harian ini di-generate.+)$/gi, "\n\n$1");
  next = next.replace(/\n{3,}/g, "\n\n");
  return next.trim();
}

function formatMarketReportContent(raw: string) {
  const sections = extractMarketSections(raw);
  const blocks: string[] = [];

  if (sections.intro) {
    blocks.push(sections.intro);
  }

  if (sections.gainers.length > 0) {
    blocks.push([
      "Saham penguat utama hari ini:",
      ...sections.gainers.map((item) => `- ${item}`),
    ].join("\n"));
  }

  if (sections.losers.length > 0) {
    blocks.push([
      "Saham penekan indeks hari ini:",
      ...sections.losers.map((item) => `- ${item}`),
    ].join("\n"));
  }

  if (sections.news.length > 0) {
    blocks.push([
      "Berita pasar yang perlu dicermati:",
      ...sections.news.map((item) => `- ${item}`),
    ].join("\n"));
  }

  if (sections.closingNote) {
    blocks.push(sections.closingNote);
  }

  if (blocks.length === 0) {
    return fallbackFormat(raw);
  }

  return normalizeWhitespace(blocks.join("\n\n"));
}

async function requestGroq(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqKey()}`,
    },
    body: JSON.stringify({
      model: ARTICLE_MODEL,
      temperature: 0.35,
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
          'Ulangi jawaban hanya dalam JSON valid tanpa penjelasan tambahan, tanpa markdown, tanpa code fence. Gunakan tepat properti {"title":"...","content":"..."}.',
      },
    ]);

    return parseJsonObject(retryResponse);
  }
}

async function generateOptimizedArticle(payload: OptimizeRequest, origin: string) {
  const title = payload.title?.trim() || "";
  const content = payload.content?.trim() || "";
  const instructions = payload.instructions?.trim() || "";
  const topicSeed = [title, instructions, content.slice(0, 300)].filter(Boolean).join(" ");

  if (!title && !content && !instructions) {
    return {
      title: "",
      content: "",
    };
  }

  const systemPrompt = [
    "Anda adalah editor artikel pasar modal untuk admin Cerita Saham.",
    "Tugas Anda adalah memperbaiki judul dan isi artikel berbahasa Indonesia agar lebih rapi, jelas, padat, dan enak dibaca.",
    "Jangan menambahkan fakta spesifik, angka, kutipan, atau klaim yang tidak ada di input pengguna kecuali berasal dari konteks luar yang diberikan.",
    "Pertahankan nada profesional yang mudah dipahami investor retail.",
    "Wajib hasilkan struktur editorial, bukan satu blok teks panjang.",
    "Gunakan paragraf pembuka singkat 2 sampai 3 kalimat.",
    "Jika ada daftar saham penguat, saham penekan, berita pasar, atau poin penting, tulis sebagai bullet list rapi dengan awalan '- ' dan satu item per baris.",
    "Sisakan satu baris kosong antar paragraf atau antar section.",
    "Jangan menulis semua poin dalam satu kalimat panjang yang dipisahkan koma.",
    "Konten harus berupa teks biasa. Jangan gunakan heading markdown, bold markdown, atau code fence.",
    "Jangan sertakan pembuka seperti 'Berikut hasil optimasinya'.",
    "Jika konteks luar memuat harga saat ini atau analisa teknikal, Anda boleh memasukkannya secara ringkas bila relevan dengan instruksi admin.",
    "Kembalikan JSON valid dengan properti: title, content.",
  ].join(" ");

  const externalContext = await buildArticleExternalContext(origin, topicSeed || title || content);
  const contextBlock = [
    externalContext.stockSymbol ? `Ticker terdeteksi: ${externalContext.stockSymbol} (${externalContext.stockName || "-"})` : "",
    externalContext.quoteSummary ? `Harga terkini:\n${externalContext.quoteSummary}` : "",
    externalContext.technicalSummary ? `Analisa teknikal:\n${externalContext.technicalSummary}` : "",
    externalContext.newsSummary ? `Informasi eksternal relevan:\n${externalContext.newsSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    `Judul saat ini: ${title || "(kosong)"}`,
    `Konten saat ini:\n${content || "(kosong)"}`,
    `Arahan tambahan admin:\n${instructions || "(tidak ada)"}`,
    contextBlock ? `Konteks luar yang relevan:\n${contextBlock}` : "",
    "Format yang diinginkan: pembuka singkat, lalu bullet list untuk beberapa item penting, lalu penutup singkat bila perlu.",
  ].join("\n\n");

  const parsed = (await groqJsonCompletion(systemPrompt, userPrompt)) as OptimizedArticle;
  const nextTitle = typeof parsed.title === "string" ? parsed.title.trim() : title;
  const sourceContent = typeof parsed.content === "string" ? parsed.content : content;

  return {
    title: nextTitle,
    content: formatMarketReportContent(sourceContent),
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<OptimizeRequest>;

    if (body.action !== "optimize") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const optimized = await generateOptimizedArticle(
      {
        action: "optimize",
        title: body.title,
        content: body.content,
        instructions: body.instructions,
      },
      req.nextUrl.origin
    );

    return NextResponse.json(optimized);
  } catch (error) {
    console.error("Article AI error:", error);

    const message =
      error instanceof Error && error.message === "GROQ_API_KEY is not configured"
        ? "GROQ_API_KEY belum dikonfigurasi"
        : "Gagal memproses permintaan AI";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}