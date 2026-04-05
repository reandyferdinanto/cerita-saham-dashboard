# Postgres Setup for VPS

This project now supports an env-driven database mode:

- `DB_PROVIDER=mongo`
  Use the old Mongo-only flow.
- `DB_PROVIDER=postgres`
  Use Postgres for the routes that already have adapters.
- `DB_PROVIDER=postgres-prefer`
  Try Postgres first, then fall back to Mongo if Postgres is missing or fails.

Recommended transition mode for VPS:

- Start with `DB_PROVIDER=postgres-prefer`
- Keep `MONGODB_URI` enabled as backup
- After Postgres data is stable, you can stay on `postgres-prefer` or switch to `postgres`

## 1. Install PostgreSQL on Ubuntu VPS

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

## 2. Create DB and App User

```bash
sudo -u postgres psql
```

```sql
create user cerita_saham_app with password 'CHANGE_ME_STRONG_PASSWORD';
create database cerita_saham owner cerita_saham_app;
grant all privileges on database cerita_saham to cerita_saham_app;
\q
```

## 3. Allow Password Login

Edit:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Make sure local app/user access uses `scram-sha-256` or `md5`, for example:

```text
local   all             cerita_saham_app                      scram-sha-256
host    all             cerita_saham_app    127.0.0.1/32     scram-sha-256
host    all             cerita_saham_app    ::1/128          scram-sha-256
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## 4. Apply Project Schema

From the project root on your VPS:

```bash
psql "postgresql://cerita_saham_app:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/cerita_saham" -f scripts/postgres/schema.sql
```

## 5. Install App Dependencies

```bash
npm install
```

This project now needs `pg` and `@types/pg`.

## 6. Configure Environment

Example `.env.production`:

```env
DB_PROVIDER=postgres-prefer
POSTGRES_URL=postgresql://cerita_saham_app:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/cerita_saham
POSTGRES_SSL=false
POSTGRES_MAX_CONNECTIONS=10

MONGODB_URI=your-existing-mongodb-uri
MONGODB_URI_DIRECT=your-existing-mongodb-direct-uri

JWT_SECRET=replace-me
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PHONE=08123456789
```

Notes:

- On local VPS Postgres, `POSTGRES_SSL=false` is the simplest default.
- Keep Mongo envs present if you want `postgres-prefer` fallback.
- If you want strict Postgres-only behavior, change to `DB_PROVIDER=postgres`.

## 7. Start the App

```bash
npm run build
npm run start
```

Or with PM2:

```bash
npm install -g pm2
pm2 start npm --name cerita-saham -- start
pm2 save
pm2 startup
```

## 8. Optional Reverse Proxy with Nginx

Install nginx:

```bash
sudo apt install -y nginx
```

Example server block:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/cerita-saham /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. What Uses Postgres Now

The Postgres adapter currently covers these app data areas:

- auth user lookup/create/update
- admin membership/user management
- site settings
- watchlist
- articles
- investor portfolio
- investor journal
- investor alerts
- investor corporate actions

## 10. What Still Uses Mongo Directly

These areas still rely on Mongo-first code today, so keep Mongo configured if you use them:

- stock summary admin data
- broker summary admin data
- Indonesia stock master sync
- bandarmology screener snapshots/backtests
- some admin assistant / cron flows that still read Mongo models directly

That means the safest VPS config today is:

```env
DB_PROVIDER=postgres-prefer
```

This gives you Postgres as the main path for migrated features, while Mongo remains your backup and compatibility layer.
