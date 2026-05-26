import { queryPostgres } from "@/lib/postgres";
import { BANDARMOLOGY_SCREEN_UNIVERSE } from "@/lib/bandarmologyAnalysis";
import fs from "fs";
import path from "path";

type PriceBucket = "all" | "under200" | "under300" | "200to500" | "above500";

type ParsedStockRow = {
  symbol: string;
  ticker: string;
  name: string;
  sourceRank: number;
  listingDate: Date | null;
  sector: string | null;
  industry: string | null;
  sharesOutstanding: string | null;
};

type LocalIdxStockRow = {
  code?: unknown;
  company_name?: unknown;
  name?: unknown;
  sector?: unknown;
  listing_date?: unknown;
  listing_board?: unknown;
};

const IDX_UNIVERSE_FILE_NAME = "idx_stocks_with_sectors_20260501.json";
export const IDX_UNIVERSE_SOURCE_URL = `/${IDX_UNIVERSE_FILE_NAME}`;
export const IDX_UNIVERSE_SOURCE_NAME = "idx-public-universe";
const STOCK_SOURCE_NAME = "idx-public-universe";
const STALE_MS = 24 * 60 * 60 * 1000;
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export async function ensureIndonesiaStocksTable() {
  await queryPostgres(`
    create table if not exists indonesia_stocks (
      ticker text primary key,
      name text not null,
      listing_date timestamptz,
      sector text,
      industry text,
      sub_industry text,
      market_cap numeric,
      shares_outstanding bigint,
      website text,
      address text,
      description text,
      is_active boolean default true,
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_indonesia_stocks_sector on indonesia_stocks (sector);
    create index if not exists idx_indonesia_stocks_industry on indonesia_stocks (industry);
    create index if not exists idx_indonesia_stocks_active on indonesia_stocks (is_active);
  `);
}

function parseIdxListingDate(value: unknown) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!day || month === undefined || !year) return null;

  return new Date(Date.UTC(year, month, day));
}

function parseSharesOutstanding(value: unknown) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

function loadIdxUniverseFromPublicFile(): ParsedStockRow[] {
  const filePath = path.join(process.cwd(), "public", IDX_UNIVERSE_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    throw new Error(`IDX stock universe file not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(parsed?.stocks) ? parsed.stocks : [];
  if (rows.length === 0) {
    throw new Error(`IDX stock universe file has no stocks: ${filePath}`);
  }

  const seen = new Set<string>();
  return rows.flatMap((row: LocalIdxStockRow, index: number): ParsedStockRow[] => {
    const symbol = String(row.code || "").trim().toUpperCase().replace(/\.JK$/, "");
    if (!symbol || seen.has(symbol)) return [];
    seen.add(symbol);

    return [{
      symbol,
      ticker: `${symbol}.JK`,
      name: String(row.company_name || row.name || symbol).replace(/\s+/g, " ").trim(),
      sourceRank: index + 1,
      listingDate: parseIdxListingDate(row.listing_date),
      sector: String(row.sector || "").trim() || null,
      industry: String(row.listing_board || "").trim() || null,
      sharesOutstanding: parseSharesOutstanding((row as { shares?: unknown }).shares),
    }];
  });
}

export async function syncIndonesiaStockMaster(force = false) {
  await ensureIndonesiaStocksTable();

  if (!force) {
    const latest = await queryPostgres<{ updated_at: Date | null; active_count: string }>(
      `select max(updated_at) as updated_at, count(*) filter (where is_active = true) as active_count from indonesia_stocks`
    );
    const latestRow = latest.rows[0];
    if (
      latestRow?.updated_at &&
      Date.now() - new Date(latestRow.updated_at).getTime() < STALE_MS &&
      Number(latestRow.active_count) > 0
    ) {
      return {
        activeCount: Number(latestRow.active_count),
        refreshed: false,
        source: STOCK_SOURCE_NAME,
        sourceUrl: IDX_UNIVERSE_SOURCE_URL,
      };
    }
  }

  const parsedRows = loadIdxUniverseFromPublicFile();

  if (parsedRows.length === 0) {
    throw new Error("Source saham Indonesia tidak mengembalikan data");
  }

  const now = new Date();
  for (const row of parsedRows) {
    await queryPostgres(
      `
        insert into indonesia_stocks (
          ticker, name, listing_date, sector, industry, shares_outstanding, is_active, updated_at
        ) values ($1, $2, $3, $4, $5, $6, true, $7)
        on conflict (ticker) do update set
          name = excluded.name,
          listing_date = excluded.listing_date,
          sector = excluded.sector,
          industry = excluded.industry,
          shares_outstanding = excluded.shares_outstanding,
          is_active = true,
          updated_at = excluded.updated_at
      `,
      [row.ticker, row.name, row.listingDate, row.sector, row.industry, row.sharesOutstanding, now]
    );
  }

  await queryPostgres(
    `update indonesia_stocks set is_active = false, updated_at = $2 where not (ticker = any($1::text[]))`,
    [parsedRows.map((row) => row.ticker), now]
  );

  const countResult = await queryPostgres<{ active_count: string }>(
    `select count(*) as active_count from indonesia_stocks where is_active = true`
  );
  const activeCount = Number(countResult.rows[0]?.active_count || 0);
  return { activeCount, refreshed: true, source: STOCK_SOURCE_NAME, sourceUrl: IDX_UNIVERSE_SOURCE_URL };
}

export async function syncIndonesiaStockProfilesFromBEI() {
  await ensureIndonesiaStocksTable();

  const detailsFile = path.join(process.cwd(), "external/idx-bei/data/companyDetailsByKodeEmiten.json");
  if (!fs.existsSync(detailsFile)) {
    return { success: false, error: "Details file not found. Run scraper first." };
  }

  try {
    const allDetails = JSON.parse(fs.readFileSync(detailsFile, "utf8"));
    const tickers = Object.keys(allDetails);
    console.log(`Syncing profiles for ${tickers.length} tickers from BEI JSON...`);

    for (const ticker of tickers) {
      const response = allDetails[ticker];
      const profile = (response.data && response.data.length > 0) ? response.data[0] : {};

      await queryPostgres(
        `
          update indonesia_stocks set
            listing_date = coalesce($2, listing_date),
            sector = coalesce($3, sector),
            industry = coalesce($4, industry),
            sub_industry = coalesce($5, sub_industry),
            website = coalesce($6, website),
            address = coalesce($7, address),
            description = coalesce($8, description),
            updated_at = now()
          where ticker = $1
        `,
        [
          `${ticker.toUpperCase().replace(/\.JK$/, "")}.JK`,
          profile.TanggalPencatatan ? new Date(profile.TanggalPencatatan) : null,
          profile.Sektor || null,
          profile.Industri || null,
          profile.SubIndustri || null,
          profile.Website || null,
          profile.Alamat || null,
          profile.ProfilSingkat || null,
        ]
      );
    }

    return { success: true, count: tickers.length };
  } catch (error) {
    console.error("Error syncing BEI profiles:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getIndonesiaStockUniverse(options?: {
  priceBucket?: PriceBucket;
  candidateLimit?: number;
}) {
  await ensureIndonesiaStocksTable();

  const hasDataResult = await queryPostgres<{ active_count: string }>(
    `select count(*) as active_count from indonesia_stocks where is_active = true`
  );
  const hasData = Number(hasDataResult.rows[0]?.active_count || 0);
  if (hasData === 0) {
    await syncIndonesiaStockMaster(true);
  } else {
    await syncIndonesiaStockMaster(false).catch(() => null);
  }

  const priceBucket = options?.priceBucket || "all";
  const candidateLimit = options?.candidateLimit || 140;
  void priceBucket;
  const fetchLimit = priceBucket === "all" ? Math.min(candidateLimit * 4, 600) : candidateLimit;

  const [masterResult, docsResult] = await Promise.all([
    queryPostgres<{ active_count: string }>(`select count(*) as active_count from indonesia_stocks where is_active = true`),
    queryPostgres<{
      ticker: string;
      symbol: string;
      name: string;
      lastPrice: number | null;
      sourceRank: number;
    }>(
      `
        select
          ticker,
          regexp_replace(ticker, '\\.JK$', '') as symbol,
          name,
          null::numeric as "lastPrice",
          row_number() over (order by ticker)::int as "sourceRank"
        from indonesia_stocks
        where is_active = true
        order by ticker asc
        limit $1
      `,
      [fetchLimit]
    ),
  ]);
  const masterUniverseSize = Number(masterResult.rows[0]?.active_count || 0);
  const bucketUniverseSize = masterUniverseSize;
  const docs = docsResult.rows;

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
