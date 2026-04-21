import { connectDB } from "@/lib/db";
import IndonesiaStock from "@/lib/models/IndonesiaStock";
import { BANDARMOLOGY_SCREEN_UNIVERSE } from "@/lib/bandarmologyAnalysis";
import fs from "fs";
import path from "path";

type PriceBucket = "all" | "under200" | "under300" | "200to500" | "above500";

type ParsedStockRow = {
  symbol: string;
  ticker: string;
  name: string;
  sourcePage: number;
  sourceRank: number;
  lastPrice: number | null;
  marketCapText: string | null;
  sourceUrl: string;
};

const STOCK_SOURCE_BASE_URL = "https://stockanalysis.com/list/indonesia-stock-exchange/";
const STOCK_SOURCE_NAME = "stockanalysis";
const STALE_MS = 24 * 60 * 60 * 1000;
const STOCK_SOURCE_EXPECTED_PAGE_SIZE = 500;

function parsePrice(raw: string) {
  const cleaned = raw.replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/,/g, "") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function parseStockListPage(page: number): Promise<ParsedStockRow[]> {
  const sourceUrl = page === 1 ? STOCK_SOURCE_BASE_URL : `${STOCK_SOURCE_BASE_URL}?page=${page}`;
  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Gagal memuat source saham Indonesia (page ${page})`);
  }

  const html = await res.text();
  const parserModule = await import("next/dist/compiled/node-html-parser");
  const root = parserModule.parse(html);
  const rows = root.querySelectorAll("table tbody tr");

  return rows.flatMap((row: any): ParsedStockRow[] => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 5) return [];

      const symbol = String(cells[1]?.text || "").trim().toUpperCase();
      const name = String(cells[2]?.text || "").replace(/\s+/g, " ").trim();
      const marketCapText = String(cells[3]?.text || "").replace(/\s+/g, " ").trim() || null;
      const priceText = String(cells[4]?.text || "").replace(/\s+/g, " ").trim();
      const rankText = String(cells[0]?.text || "").replace(/[^\d]/g, "");
      const sourceRank = Number(rankText);

      if (!symbol || !name || !sourceRank) return [];

      return [{
        symbol,
        ticker: `${symbol}.JK`,
        name,
        sourcePage: page,
        sourceRank,
        lastPrice: parsePrice(priceText),
        marketCapText,
        sourceUrl,
      }];
    });
}

export async function syncIndonesiaStockMaster(force = false) {
  await connectDB();

  if (!force) {
    const latest = await IndonesiaStock.findOne({ active: true }).sort({ lastSyncedAt: -1 }).lean();
    if (latest?.lastSyncedAt && Date.now() - new Date(latest.lastSyncedAt).getTime() < STALE_MS) {
      const activeCount = await IndonesiaStock.countDocuments({ active: true });
      return { activeCount, refreshed: false };
    }
  }

  const parsedRows: ParsedStockRow[] = [];
  for (let page = 1; page <= 4; page += 1) {
    try {
      const pageRows = await parseStockListPage(page);
      if (pageRows.length === 0) break;
      parsedRows.push(...pageRows);

      // The source list is paginated, and the final page is usually shorter.
      // Once the page size drops meaningfully below the first-page size, stop
      // instead of probing extra pages that may intermittently fail.
      if (pageRows.length < STOCK_SOURCE_EXPECTED_PAGE_SIZE * 0.9) {
        break;
      }
    } catch (error) {
      if (parsedRows.length > 0) {
        break;
      }
      throw error;
    }
  }

  if (parsedRows.length === 0) {
    throw new Error("Source saham Indonesia tidak mengembalikan data");
  }

  const now = new Date();
  await IndonesiaStock.bulkWrite(
    parsedRows.map((row) => ({
      updateOne: {
        filter: { ticker: row.ticker },
        update: {
          $set: {
            symbol: row.symbol,
            ticker: row.ticker,
            name: row.name,
            exchange: "IDX",
            source: STOCK_SOURCE_NAME,
            sourceUrl: row.sourceUrl,
            sourcePage: row.sourcePage,
            sourceRank: row.sourceRank,
            lastPrice: row.lastPrice,
            marketCapText: row.marketCapText,
            active: true,
            lastSyncedAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  await IndonesiaStock.updateMany(
    { ticker: { $nin: parsedRows.map((row) => row.ticker) } },
    { $set: { active: false, lastSyncedAt: now } }
  );

  const activeCount = await IndonesiaStock.countDocuments({ active: true });
  return { activeCount, refreshed: true };
}

export async function syncIndonesiaStockProfilesFromBEI() {
  await connectDB();

  const detailsFile = path.join(process.cwd(), "external/idx-bei/data/companyDetailsByKodeEmiten.json");
  if (!fs.existsSync(detailsFile)) {
    return { success: false, error: "Details file not found. Run scraper first." };
  }

  try {
    const allDetails = JSON.parse(fs.readFileSync(detailsFile, "utf8"));
    const tickers = Object.keys(allDetails);
    console.log(`Syncing profiles for ${tickers.length} tickers from BEI JSON...`);

    const ops = tickers.map((ticker) => {
      const response = allDetails[ticker];
      const profile = (response.data && response.data.length > 0) ? response.data[0] : {};
      
      return {
        updateOne: {
          filter: { symbol: ticker.toUpperCase() },
          update: {
            $set: {
              listingDate: profile.TanggalPencatatan ? new Date(profile.TanggalPencatatan) : null,
              sector: profile.Sektor || null,
              industry: profile.Industri || null,
              subIndustry: profile.SubIndustri || null,
              website: profile.Website || null,
              address: profile.Alamat || null,
              description: profile.ProfilSingkat || null,
            }
          }
        }
      };
    });

    if (ops.length > 0) {
      await IndonesiaStock.bulkWrite(ops, { ordered: false });
    }

    return { success: true, count: ops.length };
  } catch (error) {
    console.error("Error syncing BEI profiles:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getIndonesiaStockUniverse(options?: {
  priceBucket?: PriceBucket;
  candidateLimit?: number;
}) {
  await connectDB();

  const hasData = await IndonesiaStock.countDocuments({ active: true });
  if (hasData === 0) {
    await syncIndonesiaStockMaster(true);
  } else {
    await syncIndonesiaStockMaster(false).catch(() => null);
  }

  const priceBucket = options?.priceBucket || "all";
  const candidateLimit = options?.candidateLimit || 140;
  const activeFilter: Record<string, unknown> = { active: true };
  const bucketFilter: Record<string, unknown> = {};

  if (priceBucket === "under200") {
    bucketFilter.lastPrice = { $lt: 200 };
  } else if (priceBucket === "under300") {
    bucketFilter.lastPrice = { $lt: 300 };
  } else if (priceBucket === "200to500") {
    bucketFilter.lastPrice = { $gte: 200, $lte: 500 };
  } else if (priceBucket === "above500") {
    bucketFilter.lastPrice = { $gt: 500 };
  }

  const fetchLimit = priceBucket === "all" ? Math.min(candidateLimit * 4, 600) : candidateLimit;

  const [masterUniverseSize, bucketUniverseSize, docs] = await Promise.all([
    IndonesiaStock.countDocuments(activeFilter),
    IndonesiaStock.countDocuments({ ...activeFilter, ...bucketFilter }),
    IndonesiaStock.find({ ...activeFilter, ...bucketFilter })
      .sort({ sourceRank: 1 })
      .limit(fetchLimit)
      .select({ ticker: 1, name: 1, symbol: 1, lastPrice: 1, sourceRank: 1 })
      .lean(),
  ]);

  const prioritizedDocs = docs
    .slice()
    .sort((left, right) => {
      const leftPrice = typeof left.lastPrice === "number" ? left.lastPrice : Number.POSITIVE_INFINITY;
      const rightPrice = typeof right.lastPrice === "number" ? right.lastPrice : Number.POSITIVE_INFINITY;
      const leftBand = leftPrice <= 300 ? 0 : leftPrice <= 500 ? 1 : 2;
      const rightBand = rightPrice <= 300 ? 0 : rightPrice <= 500 ? 1 : 2;
      if (leftBand !== rightBand) return leftBand - rightBand;
      return (left.sourceRank ?? Number.MAX_SAFE_INTEGER) - (right.sourceRank ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, candidateLimit);

  const fallbackDocs =
    prioritizedDocs.length > 0
      ? prioritizedDocs
      : BANDARMOLOGY_SCREEN_UNIVERSE.map((ticker, index) => ({
          ticker,
          symbol: ticker.replace(".JK", ""),
          name: ticker.replace(".JK", ""),
          lastPrice: null,
          sourceRank: index + 1,
        }));

  return {
    masterUniverseSize,
    bucketUniverseSize,
    analyzedUniverseSize: fallbackDocs.length,
    stocks: fallbackDocs,
  };
}
