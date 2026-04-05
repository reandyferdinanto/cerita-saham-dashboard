create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  email text not null unique,
  phone_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin', 'superadmin')),
  avatar_url text,
  name text,
  membership_status text not null default 'pending' check (membership_status in ('pending', 'active', 'expired', 'rejected', 'suspended')),
  membership_duration text check (membership_duration in ('3months', '6months', '1year')),
  membership_start_date timestamptz,
  membership_end_date timestamptz,
  membership_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_membership_status on users (membership_status);
create index if not exists idx_users_created_at on users (created_at desc);

create table if not exists site_settings (
  id text primary key,
  membership_prices jsonb not null,
  payment_methods jsonb not null,
  enabled_investor_tools text[] not null,
  updated_at timestamptz not null default now()
);

create table if not exists watchlist (
  ticker text primary key,
  name text not null,
  tp numeric,
  sl numeric,
  bandarmology text not null default '',
  added_at text not null
);

create table if not exists articles (
  id text primary key,
  title text not null,
  content text not null,
  image_url text,
  is_public boolean not null default false,
  author_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_created_at on articles (created_at desc);
create index if not exists idx_articles_is_public on articles (is_public);

create table if not exists portfolio_holdings (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  name text not null,
  lots integer not null check (lots >= 1),
  average_buy_price numeric not null check (average_buy_price >= 0),
  thesis text not null default '',
  sector text not null default '',
  target_price numeric,
  stop_loss numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists idx_portfolio_holdings_user_id on portfolio_holdings (user_id, updated_at desc);

create table if not exists trade_journal_entries (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  setup_name text not null,
  side text not null default 'buy' check (side in ('buy', 'sell')),
  status text not null default 'planned' check (status in ('planned', 'open', 'closed', 'cancelled')),
  entry_price numeric not null check (entry_price >= 0),
  exit_price numeric,
  stop_loss numeric,
  target_price numeric,
  lots integer not null check (lots >= 1),
  conviction text not null default '',
  lessons text not null default '',
  strategy_notes text not null default '',
  entry_date timestamptz,
  exit_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trade_journal_entries_user_id on trade_journal_entries (user_id, updated_at desc);

create table if not exists stock_alerts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  label text not null,
  condition text not null default 'above_price' check (condition in ('above_price', 'below_price', 'above_target', 'below_stop')),
  price numeric not null check (price >= 0),
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_alerts_user_id on stock_alerts (user_id, updated_at desc);

create table if not exists corporate_actions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  title text not null,
  action_type text not null default 'other' check (action_type in ('dividend', 'rights_issue', 'stock_split', 'buyback', 'rups', 'earnings', 'other')),
  action_date timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'watching', 'done', 'cum-date', 'ex-date', 'recording-date', 'payment-date')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_corporate_actions_user_id on corporate_actions (user_id, action_date asc);
