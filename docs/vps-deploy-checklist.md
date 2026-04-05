# VPS Deploy Checklist

## Before First Deploy

1. Pull the latest code.
2. Copy `.env.production.example` to `.env.production`.
3. Fill in:
   - `DB_PROVIDER=postgres-prefer`
   - `DATABASE_URL`
   - `MONGODB_URI`
   - `MONGODB_URI_DIRECT`
   - `JWT_SECRET`
   - `SUPERADMIN_EMAIL`
   - `SUPERADMIN_PHONE`
4. Install Postgres and run `scripts/postgres/schema.sql`.

## Data Migration

If Mongo already contains production data and you want Postgres to start with the same core data:

```bash
npm install
npm run migrate:postgres-core
```

This migrates:

- users
- site settings
- watchlist
- articles
- portfolio holdings
- trade journal entries
- stock alerts
- corporate actions

## Build and Start

```bash
npm install
npm run build
npm run start
```

If you use PM2:

```bash
pm2 start npm --name cerita-saham -- start
pm2 save
```

## Recommended Runtime Mode

Use:

```env
DB_PROVIDER=postgres-prefer
```

Reason:

- migrated flows will use Postgres first
- Mongo remains available as backup and compatibility fallback
- this is the safest mode while some admin analytics flows still remain Mongo-first

## Still Mongo-First Today

Keep Mongo configured if you use:

- stock summary
- broker summary
- Indonesia stock master
- bandarmology screener snapshots/backtests

## Quick Validation After Deploy

Open and test:

1. `/login`
2. `/register`
3. `/watchlist`
4. `/admin`
5. `/admin/articles`
6. investor workspace routes:
   - portfolio
   - journal
   - alerts
   - corporate actions

## If Postgres Has a Problem

You can temporarily switch back to Mongo-only by changing:

```env
DB_PROVIDER=mongo
```

Then restart the app.