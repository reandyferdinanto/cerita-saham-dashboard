import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { getQuote } from "@/lib/yahooFinance";

// Simple RSS parser helper
function parseRSSNews(xml: string) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  // Keywords that influence the Indonesian stock market
  const relevantKeywords = /saham|ihsg|emas|minyak|komoditas|suku bunga|bursa|wall street|the fed|rupiah|dolar|investor|asing|lq45|dividen|nikkel|batu bara|cpo/i;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    
    let titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i);
    if (!titleMatch) titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    
    let descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
    if (!descMatch) descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);

    if (titleMatch && descMatch) {
      const title = titleMatch[1].trim();
      const descText = descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      
      // Filter the news by checking if the title or description contains relevant market keywords
      if (relevantKeywords.test(title) || relevantKeywords.test(descText)) {
        items.push({
          title: title,
          desc: descText.substring(0, 150) + "..."
        });
      }
    }
  }
  return items;
}

export async function GET(req: NextRequest) {
  // Check authorization in Production
  // Vercel Cron sends Authorization: Bearer process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && req.nextUrl.hostname !== "localhost") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = new Date();
    // In Vercel, Cron UTC time is evaluated safely, but for the text output we want local WIB
    const wibArr = new Date(today.getTime() + (7 * 3600 * 1000)).toISOString().split('T')[0].split('-');
    const dateStr = `${wibArr[2]}/${wibArr[1]}/${wibArr[0]}`;

    // Array of top Indonesian caps for Gainers/Losers representation
    const idxStocks = [
      "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", 
      "ASII.JK", "AMMN.JK", "BREN.JK", "BYAN.JK", "GOTO.JK", 
      "UNVR.JK", "ICBP.JK", "PGAS.JK", "BRPT.JK", "MEDC.JK", 
      "ADRO.JK", "PTBA.JK", "ITMG.JK", "UNTR.JK", "AKRA.JK"
    ];

    const [ihsg, ...quotes] = await Promise.all([
      getQuote("^JKSE").catch(() => null),
      ...idxStocks.map(t => getQuote(t).catch(() => null))
    ]);

    if (!ihsg) {
      return NextResponse.json({ error: "Gagal memuat IHSG" }, { status: 500 });
    }

    // Prepare Gainers and Losers
    const validStocks = quotes.filter(s => s && s.changePercent !== undefined) as any[];
    validStocks.sort((a, b) => b.changePercent - a.changePercent);
    
    const topGainers = validStocks.slice(0, 3);
    const topLosers = validStocks.slice(-3).reverse();

    // Fetch Market RSS
    let newsList: any[] = [];
    try {
      // First try CNBC Indonesia Market
      const ress = await fetch("https://www.cnbcindonesia.com/market/rss", { 
        next: { revalidate: 0 },
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (ress.ok) {
        const xml = await ress.text();
        newsList = parseRSSNews(xml);
      }
      
      // If CNBC is empty or fails, fallback to Detik
      if (newsList.length === 0) {
        const ressDetik = await fetch("https://finance.detik.com/bursa-valas/rss", { 
          next: { revalidate: 0 },
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (ressDetik.ok) {
          const xml = await ressDetik.text();
          newsList = parseRSSNews(xml);
        }
      }
      
      // Limit to max 3 highly relevant news
      newsList = newsList.slice(0, 3);
    } catch(e) { console.error("RSS fetch error:", e); }

    const isUp = ihsg.change >= 0;
    
    let content = `Bursa Saham Indonesia (IHSG) hari ini, ${dateStr}, ditutup pada level Rp ${ihsg.price.toLocaleString("id-ID")} (${isUp ? "+" : ""}${ihsg.change.toFixed(2)} poin / ${ihsg.changePercent.toFixed(2)}%). Kondisi makro dan pasar secara keseluruhan terpantau ${isUp ? "mengalami penguatan" : "mengalami tekanan aksi jual"} menjelang penutupan sesi yang diwarnai oleh berbagai sentimen domestik maupun global.\n\n`;

    content += `### Top Gainers Bluechip (Penggerak Utama)\n\n`;
    content += `Berikut adalah deretan saham kapitalisasi besar yang memimpin penguatan indeks pada hari ini:\n`;
    topGainers.forEach((s) => {
      content += `- ${s.ticker.replace(".JK", "")}: Rp ${Math.round(s.price).toLocaleString("id-ID")} (+${s.changePercent.toFixed(2)}%)\n`;
    });

    content += `\n### Top Losers Bluechip (Pemberat Indeks)\n\n`;
    content += `Di sisi lain, beberapa saham berikut menjadi penekan indeks kerena mengalami koreksi paling dalam:\n`;
    topLosers.forEach((s) => {
      content += `- ${s.ticker.replace(".JK", "")}: Rp ${Math.round(s.price).toLocaleString("id-ID")} (${s.changePercent.toFixed(2)}%)\n`;
    });

    content += `\n### Berita Pasar yang Mewarnai Hari Ini\n\n`;
    if (newsList.length > 0) {
      newsList.forEach((n, idx) => {
        content += `${idx + 1}. ${n.title}\n   "${n.desc}"\n\n`;
      });
    } else {
      content += `Sentimen pasar hari ini banyak dipengaruhi oleh pergerakan bursa global dan dinamika aktivitas transaksi investor ritel domestik maupun asing.\n\n`;
    }

    content += `Catatan: Laporan harian ini di-generate secara otomatis oleh Sistem Bot anomalisaham pada jam 16:15 WIB.`;

    await connectDB();
    const mongoose = require("mongoose");
    const article = await Article.create({
      title: `Ringkasan Penutupan Pasar IHSG Hari Ini - ${dateStr}`,
      content: content.trim(),
      imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1200&auto=format&fit=crop", // Ilustrasi grafik saham generic
      isPublic: true,
      authorId: new mongoose.Types.ObjectId()
    });

    return NextResponse.json({ success: true, message: "Summary generated", articleId: article._id });

  } catch (error) {
    console.error("Cron Error", error);
    return NextResponse.json({ error: "Failed to generate daily summary" }, { status: 500 });
  }
}
