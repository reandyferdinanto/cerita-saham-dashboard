const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { config } = require("dotenv");

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env.production") });
config({ path: path.resolve(process.cwd(), ".env") });

const IDX_UNIVERSE_FILE_NAME = "idx_stocks_with_sectors_20260501.json";
const IDX_UNIVERSE_SOURCE_URL = `/${IDX_UNIVERSE_FILE_NAME}`;
const STOCK_SOURCE_NAME = "idx-public-universe";
const MONTH_INDEX = {
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

function parseIdxListingDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = Number(match[3]);
  if (!day || month === undefined || !year) return null;

  return new Date(Date.UTC(year, month, day));
}

function parseSharesOutstanding(value) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

function loadRows() {
  const filePath = path.join(process.cwd(), "public", IDX_UNIVERSE_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    throw new Error(`IDX stock universe file not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(parsed.stocks) ? parsed.stocks : [];
  const seen = new Set();

  return rows.flatMap((row) => {
    const symbol = String(row.code || "").trim().toUpperCase().replace(/\.JK$/, "");
    if (!symbol || seen.has(symbol)) return [];
    seen.add(symbol);

    return [{
      ticker: `${symbol}.JK`,
      name: String(row.company_name || row.name || symbol).replace(/\s+/g, " ").trim(),
      listingDate: parseIdxListingDate(row.listing_date),
      sector: String(row.sector || "").trim() || null,
      industry: String(row.listing_board || "").trim() || null,
      sharesOutstanding: parseSharesOutstanding(row.shares),
    }];
  });
}

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Please define POSTGRES_URL or DATABASE_URL");
  }

  const rows = loadRows();
  if (rows.length === 0) {
    throw new Error("IDX stock universe file has no valid rows");
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.POSTGRES_SSL === "false"
      ? false
      : { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "true" },
    max: Number(process.env.POSTGRES_MAX_CONNECTIONS || 10),
  });
  const client = await pool.connect();

  try {
    const now = new Date();
    await client.query("begin");
    await client.query(`
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

    for (const row of rows) {
      await client.query(
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

    await client.query(
      "update indonesia_stocks set is_active = false, updated_at = $2 where not (ticker = any($1::text[]))",
      [rows.map((row) => row.ticker), now]
    );

    await client.query("commit");

    const result = await client.query(`
      select
        count(*) filter (where is_active = true) as active_count,
        count(distinct sector) filter (where is_active = true and sector is not null and sector <> '') as sector_count,
        count(*) filter (where is_active = true and (sector is null or sector = '')) as missing_sector_count
      from indonesia_stocks
    `);
    const row = result.rows[0];

    console.log(JSON.stringify({
      ok: true,
      importedRows: rows.length,
      activeCount: Number(row.active_count || 0),
      sectorCount: Number(row.sector_count || 0),
      missingSectorCount: Number(row.missing_sector_count || 0),
      source: STOCK_SOURCE_NAME,
      sourceUrl: IDX_UNIVERSE_SOURCE_URL,
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => null);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
