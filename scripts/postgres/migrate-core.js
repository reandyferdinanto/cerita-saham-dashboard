require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env.production" });

const mongoose = require("mongoose");
const { Pool } = require("pg");

const mongoUri = process.env.MONGODB_URI_DIRECT || process.env.MONGODB_URI;
const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!mongoUri) {
  console.error("Missing MONGODB_URI or MONGODB_URI_DIRECT");
  process.exit(1);
}

if (!postgresUrl) {
  console.error("Missing POSTGRES_URL or DATABASE_URL");
  process.exit(1);
}

const ssl =
  process.env.POSTGRES_SSL === "false"
    ? false
    : { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "true" };

const pool = new Pool({
  connectionString: postgresUrl,
  ssl,
});

function asTextId(value) {
  if (!value) return null;
  return String(value);
}

function asIsoString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function migrateUsers() {
  const rows = await mongoose.connection.collection("users").find({}).toArray();
  let count = 0;

  for (const row of rows) {
    await pool.query(
      `insert into users (
        id, email, phone_hash, role, avatar_url, name, membership_status, membership_duration,
        membership_start_date, membership_end_date, membership_note, created_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      on conflict (id) do update set
        email = excluded.email,
        phone_hash = excluded.phone_hash,
        role = excluded.role,
        avatar_url = excluded.avatar_url,
        name = excluded.name,
        membership_status = excluded.membership_status,
        membership_duration = excluded.membership_duration,
        membership_start_date = excluded.membership_start_date,
        membership_end_date = excluded.membership_end_date,
        membership_note = excluded.membership_note,
        updated_at = excluded.updated_at`,
      [
        asTextId(row._id),
        row.email,
        row.phoneHash,
        row.role || "user",
        row.avatarUrl || null,
        row.name || null,
        row.membershipStatus || "pending",
        row.membershipDuration || null,
        asIsoString(row.membershipStartDate),
        asIsoString(row.membershipEndDate),
        row.membershipNote || null,
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ]
    );
    count += 1;
  }

  console.log(`Users migrated: ${count}`);
}

async function migrateSiteSettings() {
  const row = await mongoose.connection.collection("sitesettings").findOne({});
  if (!row) {
    console.log("SiteSettings migrated: 0");
    return;
  }

  await pool.query(
    `insert into site_settings (id, membership_prices, payment_methods, enabled_investor_tools, updated_at)
     values ('default', $1::jsonb, $2::jsonb, $3::text[], $4)
     on conflict (id) do update set
       membership_prices = excluded.membership_prices,
       payment_methods = excluded.payment_methods,
       enabled_investor_tools = excluded.enabled_investor_tools,
       updated_at = excluded.updated_at`,
    [
      JSON.stringify(row.membershipPrices || {}),
      JSON.stringify(row.paymentMethods || []),
      Array.isArray(row.enabledInvestorTools) ? row.enabledInvestorTools : [],
      asIsoString(row.updatedAt) || new Date().toISOString(),
    ]
  );

  console.log("SiteSettings migrated: 1");
}

async function migrateWatchlist() {
  const rows = await mongoose.connection.collection("watchlists").find({}).toArray();
  let count = 0;

  for (const row of rows) {
    await pool.query(
      `insert into watchlist (ticker, name, tp, sl, bandarmology, added_at)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (ticker) do update set
         name = excluded.name,
         tp = excluded.tp,
         sl = excluded.sl,
         bandarmology = excluded.bandarmology,
         added_at = excluded.added_at`,
      [
        String(row.ticker || "").toUpperCase(),
        row.name || row.ticker,
        row.tp ?? null,
        row.sl ?? null,
        row.bandarmology || "",
        row.addedAt || new Date().toISOString(),
      ]
    );
    count += 1;
  }

  console.log(`Watchlist migrated: ${count}`);
}

async function migrateArticles() {
  const rows = await mongoose.connection.collection("articles").find({}).toArray();
  let count = 0;

  for (const row of rows) {
    await pool.query(
      `insert into articles (id, title, content, image_url, is_public, author_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do update set
         title = excluded.title,
         content = excluded.content,
         image_url = excluded.image_url,
         is_public = excluded.is_public,
         author_id = excluded.author_id,
         updated_at = excluded.updated_at`,
      [
        asTextId(row._id),
        row.title,
        row.content,
        row.imageUrl || null,
        Boolean(row.isPublic),
        asTextId(row.authorId),
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ]
    );
    count += 1;
  }

  console.log(`Articles migrated: ${count}`);
}

async function migrateTable({ mongoCollection, label, mapRow }) {
  const rows = await mongoose.connection.collection(mongoCollection).find({}).toArray();
  let count = 0;

  for (const row of rows) {
    const mapped = mapRow(row);
    await pool.query(mapped.sql, mapped.params);
    count += 1;
  }

  console.log(`${label} migrated: ${count}`);
}

async function main() {
  await mongoose.connect(mongoUri, { family: 4, serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");

  await pool.query("select 1");
  console.log("Connected to Postgres");

  await migrateUsers();
  await migrateSiteSettings();
  await migrateWatchlist();
  await migrateArticles();

  await migrateTable({
    mongoCollection: "portfolioholdings",
    label: "Portfolio holdings",
    mapRow: (row) => ({
      sql: `insert into portfolio_holdings (
              id, user_id, ticker, name, lots, average_buy_price, thesis, sector, target_price, stop_loss, created_at, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            on conflict (id) do update set
              user_id = excluded.user_id,
              ticker = excluded.ticker,
              name = excluded.name,
              lots = excluded.lots,
              average_buy_price = excluded.average_buy_price,
              thesis = excluded.thesis,
              sector = excluded.sector,
              target_price = excluded.target_price,
              stop_loss = excluded.stop_loss,
              updated_at = excluded.updated_at`,
      params: [
        asTextId(row._id),
        row.userId,
        String(row.ticker || "").toUpperCase(),
        row.name || row.ticker,
        Number(row.lots || 0),
        Number(row.averageBuyPrice || 0),
        row.thesis || "",
        row.sector || "",
        row.targetPrice ?? null,
        row.stopLoss ?? null,
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ],
    }),
  });

  await migrateTable({
    mongoCollection: "tradejournalentries",
    label: "Trade journal entries",
    mapRow: (row) => ({
      sql: `insert into trade_journal_entries (
              id, user_id, ticker, setup_name, side, status, entry_price, exit_price, stop_loss, target_price,
              lots, conviction, lessons, strategy_notes, entry_date, exit_date, created_at, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            on conflict (id) do update set
              user_id = excluded.user_id,
              ticker = excluded.ticker,
              setup_name = excluded.setup_name,
              side = excluded.side,
              status = excluded.status,
              entry_price = excluded.entry_price,
              exit_price = excluded.exit_price,
              stop_loss = excluded.stop_loss,
              target_price = excluded.target_price,
              lots = excluded.lots,
              conviction = excluded.conviction,
              lessons = excluded.lessons,
              strategy_notes = excluded.strategy_notes,
              entry_date = excluded.entry_date,
              exit_date = excluded.exit_date,
              updated_at = excluded.updated_at`,
      params: [
        asTextId(row._id),
        row.userId,
        String(row.ticker || "").toUpperCase(),
        row.setupName || "Trading setup",
        row.side || "buy",
        row.status || "planned",
        Number(row.entryPrice || 0),
        row.exitPrice ?? null,
        row.stopLoss ?? null,
        row.targetPrice ?? null,
        Number(row.lots || 0),
        row.conviction || "",
        row.lessons || "",
        row.strategyNotes || "",
        asIsoString(row.entryDate),
        asIsoString(row.exitDate),
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ],
    }),
  });

  await migrateTable({
    mongoCollection: "stockalerts",
    label: "Stock alerts",
    mapRow: (row) => ({
      sql: `insert into stock_alerts (
              id, user_id, ticker, label, condition, price, is_active, notes, created_at, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            on conflict (id) do update set
              user_id = excluded.user_id,
              ticker = excluded.ticker,
              label = excluded.label,
              condition = excluded.condition,
              price = excluded.price,
              is_active = excluded.is_active,
              notes = excluded.notes,
              updated_at = excluded.updated_at`,
      params: [
        asTextId(row._id),
        row.userId,
        String(row.ticker || "").toUpperCase(),
        row.label || "Alert harga",
        row.condition || "above_price",
        Number(row.price || 0),
        row.isActive !== false,
        row.notes || "",
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ],
    }),
  });

  await migrateTable({
    mongoCollection: "corporateactions",
    label: "Corporate actions",
    mapRow: (row) => ({
      sql: `insert into corporate_actions (
              id, user_id, ticker, title, action_type, action_date, status, notes, created_at, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            on conflict (id) do update set
              user_id = excluded.user_id,
              ticker = excluded.ticker,
              title = excluded.title,
              action_type = excluded.action_type,
              action_date = excluded.action_date,
              status = excluded.status,
              notes = excluded.notes,
              updated_at = excluded.updated_at`,
      params: [
        asTextId(row._id),
        row.userId,
        String(row.ticker || "").toUpperCase(),
        row.title || "Aksi korporasi",
        row.actionType || "other",
        asIsoString(row.actionDate) || new Date().toISOString(),
        row.status || "upcoming",
        row.notes || "",
        asIsoString(row.createdAt) || new Date().toISOString(),
        asIsoString(row.updatedAt) || asIsoString(row.createdAt) || new Date().toISOString(),
      ],
    }),
  });
}

main()
  .then(async () => {
    await mongoose.disconnect();
    await pool.end();
    console.log("Core migration completed");
  })
  .catch(async (error) => {
    console.error("Migration failed:", error);
    await mongoose.disconnect().catch(() => null);
    await pool.end().catch(() => null);
    process.exit(1);
  });