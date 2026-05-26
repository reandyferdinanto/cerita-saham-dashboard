import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { queryPostgres } from "@/lib/postgres";
import { runWithDatabasePreference } from "@/lib/data/provider";
import { DEFAULT_SITE_SETTINGS } from "@/lib/data/shared";

export type TelegramSettings = {
  telegramBotToken: string;
  telegramWebhookUrl: string;
  telegramAdminChatId: string;
  telegramAdminThreadId: string;
  mlScreenerBotToken: string;
  mlScreenerChatId: string;
  watchlistAlertEnabled: boolean;
  watchlistAlertBotToken: string;
  watchlistAlertChatId: string;
  watchlistAlertThreadId: string;
  watchlistAlertMinEmaOffset: number;
  watchlistAlertMaxEmaOffset: number;
  watchlistAlertOpenOffset: number;
  watchlistAlertEma20Enabled: boolean;
  watchlistAlertEma20Min: number;
  watchlistAlertEma20Max: number;
  watchlistAlertEma50Enabled: boolean;
  watchlistAlertEma50Min: number;
  watchlistAlertEma50Max: number;
  watchlistAlertOpenGapEnabled: boolean;
  watchlistAlertOpenGapMin: number;
  watchlistAlertUniverse: "watchlist" | "all";
  watchlistAlertMinGain: number;
  // ── Member Telegram Bot (separate bot, NVIDIA NIM AI Brief + chart) ──
  memberBotEnabled: boolean;
  memberBotToken: string;
  memberBotWebhookUrl: string;
  memberBotRateLimitPerDay: number; // per chat_id, default 25
  memberBotCacheMinutes: number; // brief cache TTL, default 30
};

export type TelegramSettingsPatch = Partial<TelegramSettings>;

const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  telegramBotToken: "",
  telegramWebhookUrl: "",
  telegramAdminChatId: "",
  telegramAdminThreadId: "",
  mlScreenerBotToken: "",
  mlScreenerChatId: "",
  watchlistAlertEnabled: false,
  watchlistAlertBotToken: "",
  watchlistAlertChatId: "",
  watchlistAlertThreadId: "",
  watchlistAlertMinEmaOffset: 1,
  watchlistAlertMaxEmaOffset: 2,
  watchlistAlertOpenOffset: 2,
  watchlistAlertEma20Enabled: true,
  watchlistAlertEma20Min: 1,
  watchlistAlertEma20Max: 2,
  watchlistAlertEma50Enabled: false,
  watchlistAlertEma50Min: 1,
  watchlistAlertEma50Max: 2,
  watchlistAlertOpenGapEnabled: true,
  watchlistAlertOpenGapMin: 2,
  watchlistAlertUniverse: "watchlist",
  watchlistAlertMinGain: 5,
  memberBotEnabled: false,
  memberBotToken: "",
  memberBotWebhookUrl: "",
  memberBotRateLimitPerDay: 25,
  memberBotCacheMinutes: 30,
};

const POSTGRES_COLUMNS: Record<keyof TelegramSettings, string> = {
  telegramBotToken: "telegram_bot_token",
  telegramWebhookUrl: "telegram_webhook_url",
  telegramAdminChatId: "telegram_admin_chat_id",
  telegramAdminThreadId: "telegram_admin_thread_id",
  mlScreenerBotToken: "ml_screener_bot_token",
  mlScreenerChatId: "ml_screener_chat_id",
  watchlistAlertEnabled: "watchlist_alert_enabled",
  watchlistAlertBotToken: "watchlist_alert_bot_token",
  watchlistAlertChatId: "watchlist_alert_chat_id",
  watchlistAlertThreadId: "watchlist_alert_thread_id",
  watchlistAlertMinEmaOffset: "watchlist_alert_min_ema_offset",
  watchlistAlertMaxEmaOffset: "watchlist_alert_max_ema_offset",
  watchlistAlertOpenOffset: "watchlist_alert_open_offset",
  watchlistAlertEma20Enabled: "watchlist_alert_ema20_enabled",
  watchlistAlertEma20Min: "watchlist_alert_ema20_min",
  watchlistAlertEma20Max: "watchlist_alert_ema20_max",
  watchlistAlertEma50Enabled: "watchlist_alert_ema50_enabled",
  watchlistAlertEma50Min: "watchlist_alert_ema50_min",
  watchlistAlertEma50Max: "watchlist_alert_ema50_max",
  watchlistAlertOpenGapEnabled: "watchlist_alert_open_gap_enabled",
  watchlistAlertOpenGapMin: "watchlist_alert_open_gap_min",
  watchlistAlertUniverse: "watchlist_alert_universe",
  watchlistAlertMinGain: "watchlist_alert_min_gain",
  memberBotEnabled: "member_bot_enabled",
  memberBotToken: "member_bot_token",
  memberBotWebhookUrl: "member_bot_webhook_url",
  memberBotRateLimitPerDay: "member_bot_rate_limit_per_day",
  memberBotCacheMinutes: "member_bot_cache_minutes",
};

let postgresColumnsReady = false;

export async function ensureTelegramSettingsColumns() {
  if (postgresColumnsReady) return;
  try {
    await queryPostgres(`
      alter table site_settings
        add column if not exists telegram_bot_token text not null default '',
        add column if not exists telegram_webhook_url text not null default '',
        add column if not exists telegram_admin_chat_id text not null default '',
        add column if not exists telegram_admin_thread_id text not null default '',
        add column if not exists ml_screener_bot_token text not null default '',
        add column if not exists ml_screener_chat_id text not null default '',
        add column if not exists watchlist_alert_enabled boolean not null default false,
        add column if not exists watchlist_alert_bot_token text not null default '',
        add column if not exists watchlist_alert_chat_id text not null default '',
        add column if not exists watchlist_alert_thread_id text not null default '',
        add column if not exists watchlist_alert_min_ema_offset numeric not null default 1,
        add column if not exists watchlist_alert_max_ema_offset numeric not null default 2,
        add column if not exists watchlist_alert_open_offset numeric not null default 2,
        add column if not exists watchlist_alert_ema20_enabled boolean not null default true,
        add column if not exists watchlist_alert_ema20_min numeric not null default 1,
        add column if not exists watchlist_alert_ema20_max numeric not null default 2,
        add column if not exists watchlist_alert_ema50_enabled boolean not null default false,
        add column if not exists watchlist_alert_ema50_min numeric not null default 1,
        add column if not exists watchlist_alert_ema50_max numeric not null default 2,
        add column if not exists watchlist_alert_open_gap_enabled boolean not null default true,
        add column if not exists watchlist_alert_open_gap_min numeric not null default 2,
        add column if not exists watchlist_alert_universe text not null default 'watchlist',
        add column if not exists watchlist_alert_min_gain numeric not null default 5,
        add column if not exists member_bot_enabled boolean not null default false,
        add column if not exists member_bot_token text not null default '',
        add column if not exists member_bot_webhook_url text not null default '',
        add column if not exists member_bot_rate_limit_per_day integer not null default 25,
        add column if not exists member_bot_cache_minutes integer not null default 30
    `);
  } catch (error) {
    if ((error as { code?: string }).code !== "42501") throw error;
  }
  postgresColumnsReady = true;
}

async function ensureDefaultPostgresSettings() {
  await queryPostgres(
    `insert into site_settings (id, membership_prices, payment_methods, enabled_investor_tools)
     values ('default', $1::jsonb, $2::jsonb, $3::text[])
     on conflict (id) do nothing`,
    [
      JSON.stringify(DEFAULT_SITE_SETTINGS.membershipPrices),
      JSON.stringify(DEFAULT_SITE_SETTINGS.paymentMethods),
      DEFAULT_SITE_SETTINGS.enabledInvestorTools,
    ]
  );
}

function fromPostgres(row: Record<string, unknown> | undefined): TelegramSettings {
  if (!row) return DEFAULT_TELEGRAM_SETTINGS;
  return {
    telegramBotToken: String(row.telegram_bot_token ?? ""),
    telegramWebhookUrl: String(row.telegram_webhook_url ?? ""),
    telegramAdminChatId: String(row.telegram_admin_chat_id ?? ""),
    telegramAdminThreadId: String(row.telegram_admin_thread_id ?? ""),
    mlScreenerBotToken: String(row.ml_screener_bot_token ?? ""),
    mlScreenerChatId: String(row.ml_screener_chat_id ?? ""),
    watchlistAlertEnabled: Boolean(row.watchlist_alert_enabled),
    watchlistAlertBotToken: String(row.watchlist_alert_bot_token ?? ""),
    watchlistAlertChatId: String(row.watchlist_alert_chat_id ?? ""),
    watchlistAlertThreadId: String(row.watchlist_alert_thread_id ?? ""),
    watchlistAlertMinEmaOffset: Number(row.watchlist_alert_min_ema_offset ?? 1),
    watchlistAlertMaxEmaOffset: Number(row.watchlist_alert_max_ema_offset ?? 2),
    watchlistAlertOpenOffset: Number(row.watchlist_alert_open_offset ?? 2),
    watchlistAlertEma20Enabled: row.watchlist_alert_ema20_enabled !== false,
    watchlistAlertEma20Min: Number(row.watchlist_alert_ema20_min ?? 1),
    watchlistAlertEma20Max: Number(row.watchlist_alert_ema20_max ?? 2),
    watchlistAlertEma50Enabled: Boolean(row.watchlist_alert_ema50_enabled),
    watchlistAlertEma50Min: Number(row.watchlist_alert_ema50_min ?? 1),
    watchlistAlertEma50Max: Number(row.watchlist_alert_ema50_max ?? 2),
    watchlistAlertOpenGapEnabled: row.watchlist_alert_open_gap_enabled !== false,
    watchlistAlertOpenGapMin: Number(row.watchlist_alert_open_gap_min ?? 2),
    watchlistAlertUniverse: row.watchlist_alert_universe === "all" ? "all" : "watchlist",
    watchlistAlertMinGain: Number(row.watchlist_alert_min_gain ?? 5),
    memberBotEnabled: Boolean(row.member_bot_enabled),
    memberBotToken: String(row.member_bot_token ?? ""),
    memberBotWebhookUrl: String(row.member_bot_webhook_url ?? ""),
    memberBotRateLimitPerDay: Number(row.member_bot_rate_limit_per_day ?? 25),
    memberBotCacheMinutes: Number(row.member_bot_cache_minutes ?? 30),
  };
}

function fromMongo(settings: any): TelegramSettings {
  return {
    ...DEFAULT_TELEGRAM_SETTINGS,
    telegramBotToken: settings?.telegramBotToken || "",
    telegramWebhookUrl: settings?.telegramWebhookUrl || "",
    telegramAdminChatId: settings?.telegramAdminChatId || "",
    telegramAdminThreadId: settings?.telegramAdminThreadId || "",
    mlScreenerBotToken: settings?.mlScreenerBotToken || "",
    mlScreenerChatId: settings?.mlScreenerChatId || "",
    watchlistAlertEnabled: settings?.watchlistAlertEnabled || false,
    watchlistAlertBotToken: settings?.watchlistAlertBotToken || "",
    watchlistAlertChatId: settings?.watchlistAlertChatId || "",
    watchlistAlertThreadId: settings?.watchlistAlertThreadId || "",
    watchlistAlertMinEmaOffset: settings?.watchlistAlertMinEmaOffset || 1,
    watchlistAlertMaxEmaOffset: settings?.watchlistAlertMaxEmaOffset || 2,
    watchlistAlertOpenOffset: settings?.watchlistAlertOpenOffset || 2,
    watchlistAlertEma20Enabled: settings?.watchlistAlertEma20Enabled ?? true,
    watchlistAlertEma20Min: settings?.watchlistAlertEma20Min ?? 1,
    watchlistAlertEma20Max: settings?.watchlistAlertEma20Max ?? 2,
    watchlistAlertEma50Enabled: settings?.watchlistAlertEma50Enabled ?? false,
    watchlistAlertEma50Min: settings?.watchlistAlertEma50Min ?? 1,
    watchlistAlertEma50Max: settings?.watchlistAlertEma50Max ?? 2,
    watchlistAlertOpenGapEnabled: settings?.watchlistAlertOpenGapEnabled ?? true,
    watchlistAlertOpenGapMin: settings?.watchlistAlertOpenGapMin ?? 2,
    watchlistAlertUniverse: settings?.watchlistAlertUniverse || "watchlist",
    watchlistAlertMinGain: settings?.watchlistAlertMinGain || 5,
    memberBotEnabled: settings?.memberBotEnabled || false,
    memberBotToken: settings?.memberBotToken || "",
    memberBotWebhookUrl: settings?.memberBotWebhookUrl || "",
    memberBotRateLimitPerDay: settings?.memberBotRateLimitPerDay || 25,
    memberBotCacheMinutes: settings?.memberBotCacheMinutes || 30,
  };
}

export async function getTelegramSettings() {
  return runWithDatabasePreference(
    "getTelegramSettings",
    async () => {
      await ensureTelegramSettingsColumns();
      await ensureDefaultPostgresSettings();
      const result = await queryPostgres(`select * from site_settings where id = 'default' limit 1`);
      return fromPostgres(result.rows[0]);
    },
    async () => {
      await connectDB();
      const settings = await SiteSettings.findOne({});
      return fromMongo(settings);
    }
  );
}

export async function updateTelegramSettings(patch: TelegramSettingsPatch) {
  return runWithDatabasePreference(
    "updateTelegramSettings",
    async () => {
      await ensureTelegramSettingsColumns();
      await ensureDefaultPostgresSettings();

      const entries = Object.entries(patch) as [keyof TelegramSettings, TelegramSettings[keyof TelegramSettings]][];
      if (entries.length === 0) return getTelegramSettings();

      const assignments = entries.map(([key], index) => `${POSTGRES_COLUMNS[key]} = $${index + 1}`);
      const values = entries.map(([, value]) => value);
      await queryPostgres(
        `update site_settings set ${assignments.join(", ")}, updated_at = now() where id = 'default'`,
        values
      );
      return getTelegramSettings();
    },
    async () => {
      await connectDB();
      const settings = await SiteSettings.findOneAndUpdate({}, patch, { upsert: true, new: true });
      return fromMongo(settings);
    }
  );
}

export async function clearTelegramSettings() {
  return updateTelegramSettings(DEFAULT_TELEGRAM_SETTINGS);
}
