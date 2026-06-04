# Port Usage Registry - Cerita Saham VPS

Gunakan daftar ini sebagai referensi sebelum mendeploy aplikasi baru untuk menghindari bentrok port.

| Port | Application / Domain | Status |
| :--- | :--- | :--- |
| 3000 | `porto-reandy` | ACTIVE |
| 3001 | `reandy.ebite.biz.id` (Next.js Frontend) | ACTIVE |
| 3002 | `bursa.ebite.biz.id` (BursaLens Next.js) | ACTIVE |
| 3003 | `selaras.ebite.biz.id` | ACTIVE |
| 3004 | `ultimate-screener.ebite.biz.id` | ACTIVE |
| 3005 | `ceritasaham-dashboard.my.id` (Dashboard) | ACTIVE |
| 8000 | `api-reandy.ebite.biz.id` (Backend/Supabase) | ACTIVE |
| 18789 | `ai.ebite.biz.id` / `selaras` (Internal API) | ACTIVE |

### Next Available Ports:
- 3006
- 3007
- 3008
- 3009
- 3010

---
*Terakhir diupdate: 23 April 2026*

## Product Notes
- `/insights` is the premium public/member insight desk using dashboard typography and mobile-specific card density; article badges label auto content as `AI Article` and manual content as `Special Article`, and auto articles older than 5 days are hidden from the public desk while manual articles remain visible.
- `/api/news` merges Detik finance/bursa RSS with fresh IPOT News AJAX pages (`ajax_generalNewsPagesMore.php`, levels topnews/stocks/jci/marketoverview/industries/komoditi/currencies); legacy IPOT RSS is stale since 2017 and should not be used.
- `/` dashboard distinguishes public preview, inactive account, and active member modes; hero copy mirrors `/guidance` philosophy: finding quiet structural/volume anomalies and accumulation traces before the crowd, with disciplined risk context.
- `/` dashboard uses premium single-font styling, stable hero copy during auth loading, curated small-ticket quick chips, redesigned IHSG market pulse card, hides bank/financial stock names from quick/search UI, and ends with casual Indonesian FAQ for signal scale, avg down, avoided sectors, and H+2 selling principle.
- `/` dashboard has mobile-specific layout tuning: compact hero, full-width CTAs, smaller search/chart surfaces, denser market cards, and mobile-safe IHSG chart height through `LineChart.mobileHeight`.
- `/` dashboard typography uses `Alegreya Sans` for UI/body and `Bodoni Moda` for display headings; member stock search opens an inline `StockQuickPanel` below the search box instead of a chart modal, while non-member/inactive users still get the access CTA modal.
- `/api/news/market-ticker` merges Detik market RSS (`finance.detik.com/bursa-valas/rss`, with `finance.detik.com/rss` market fallback) and fresh IPOT News AJAX pages, cached for 5 minutes; output is balanced so IPOT items remain visible.
- Main navbar exposes `/search` as `Chart` for logged-in members so the full stock chart/search workspace has its own menu entry.
- Main navbar does not show an `IDX LIVE` badge because market data comes through delayed yfinance/Yahoo Finance feeds.
- Mobile navbar is horizontally scrollable instead of truncating role-based links; Admin Copilot stays default-closed on mobile and only auto-opens for admin/superadmin on desktop-width viewports.
- Navbar/BrandMark use `/anomali-saham-mark.png`, a cropped round AS mark derived from the main logo, so small logo surfaces avoid the square checkerboard background.
- TechnicalSignalPanel includes `Radar Momentum` as a low-weight signal breakdown item, while the visual Radar chart stays only in the shared candlestick chart.
- Shared `CandlestickChart` turns `Radar` on by default and renders Radar Momentum as the bottom oscillator pane below MACD in the same chart instance, with momentum, flux, squeeze, and divergence markers.
- `/api/cron/daily-summary` runs after IDX close (Vercel cron `15 9 * * 1-5`, 16:15 WIB) and creates a public closing-summary article through the shared article data adapter.
- Daily closing-summary articles (`/api/cron/daily-summary`, Vercel cron `15 9 * * 1-5`) explicitly randomize one of 5 distinct generated SVG illustration layouts without showing IHSG price/level labels.
- Daily closing-summary articles rank same-day WIB news from `/api/news` plus CNBC Market RSS, classify headline impact as positive/negative/neutral, and structure output into ringkasan penutupan, sentimen berita, dampak ke IHSG, penggerak indeks, and next-session watchlist.
- Admin article form (`/admin?tab=articles` and `/admin/articles`) exposes the same 5 distinct market illustration variants as optional thumbnails; selecting one writes the generated SVG data URL into `imageUrl`, while manual image URLs remain supported.
- `/research` is a manual admin/superadmin-only research desk for Analisa Bandar, Smart Money, and Riwayat Performa; `/admin` no longer exposes those panels or links to them, and related research APIs require admin session.
- `/admin` uses a quieter dashboard/insights-style operational shell with compact horizontal panel navigation and active-panel context for watchlist, stock summary, breakdown, articles, members, and Telegram.
- Telegram admin UI currently exposes only the main bot (token, admin chat/thread, `/chart`/ticker commands); secondary ML/watchlist bot settings are cleared/hidden for now. Chart screenshots are uploaded to Telegram from the local PNG file instead of a public static URL. Postgres stores Telegram fields on `site_settings`, and webhook dedup uses `telegram_updates`; Mongo remains fallback for Mongo mode.
- `/admin?tab=telegram` has dual-tab UI: **Admin Bot** (`/api/telegram/webhook`, existing) and **Member Bot** (`/api/telegram/member/webhook`, NEW). Member bot uses a separate Telegram token, responds to ticker messages with chart screenshot + AI brief generated via NVIDIA NIM `openai/gpt-oss-20b` (free, rate-limited). Settings: `member_bot_enabled`, `member_bot_token`, `member_bot_webhook_url`, `member_bot_rate_limit_per_day` (default 25), `member_bot_cache_minutes` (default 30) — all in `site_settings`. Brief cache is in-memory per server instance keyed by ticker. Rate limit per `chat_id` resets at 00:00 WIB. Setup/clear via `/api/admin/telegram/member-setup` (GET/POST/DELETE).
- Telegram ticker/chart responses include a compact Markdown conclusion block scoring markup vs sideways from previous day high/low, 20D range/volume ratios, intraday close position, and rejection risk; design notes live in `docs/telegram-spike-conclusion.md`.
- `/admin?tab=breakdown` provides an admin-only daily candle breakdown chart with price + MA5/MA10/MA20/MA60; clicked candles show centered H/L/Close rows for 5 trading candles before/after using compact `dd/mm/yyyy` dates and `-2/-1/0/+1/+2` positions, can be saved/deleted in a local admin high-low list, and saved row dates reopen the matching ticker/date in the chart.
- `/admin?tab=stock-summary` analysis fetches 60 trading days and runs `lib/technicalIndicators.ts` per candidate: ATR(14), RVOL(20), MFI(14), RSI(14), MACD, BB Squeeze, NR7, Inside Bar, Pocket Pivot, 6M high break, swing high/low, plus an ATR+structure trade plan (entry/SL/TP1/TP2/R:R). Candidates expose `setups[]`, `tradePlan`, and `technicalScore` (0-50 added to convictionScore); strong tech setups can promote `Pantau`/`Akumulasi Kuat` to `Akumulasi Siap Jalan`. UI shows trade plan card, setup tags, indicator strip, and a R/R minimum filter (Off, 1:1.5, 1:2, 1:2.5, 1:3) passed via `?minRR=` to `/api/admin/stock-summary/analysis`.
- `/admin?tab=stock-summary` candidates also expose `pumpExhaustion`, `changePercent`, and `riskWarnings[]` to flag late-stage pumps: daily move ≥12% reduces conviction (≥15% by 22, ≥20% by 30) and prevents promotion to Akumulasi Siap Jalan; ATR≥5% of price adds volatility warning. UI surfaces these via a red ⚠ Risk box with PUMP badge above the trade plan.
- `/admin?tab=stock-summary` auto-calls `POST /api/admin/stock-summary/live-status` (yfinance) after candidates load to compare current price vs trade plan; each card shows a Live status badge (sl_hit/near_sl/above_entry/setup_valid/better_entry/tp1_reached/tp2_reached) with current price, vs-entry %, distance to SL/TP1, intraday-low SL hit flag, and an Indonesian recommendation. Manual `🔄 Refresh Live` button lives next to the R/R filter.
- AI Stock Brief (`/api/investor/ai-brief`) merges Yahoo quote + 220-day history + technical signals + cached news (30-day Mongo TTL on `NewsArticle`, 6h freshness) + fundamental snapshot (yahoo `quoteSummary`: sector, PE, PBV, beta, dividend yield, growth, ROE, D/E, analyst recommendation) + accumulation snapshot (last 10 days of `StockSummaryRow` with foreign net flow, bid/offer ratio, close-near-high count, classified into `Akumulasi/Distribusi Kuat/Moderat/Netral` and `Tekanan Beli/Jual`). Groq prompt structured into HARGA & TEKNIKAL / FUNDAMENTAL / AKUMULASI / BERITA 30 HARI sections. Investor-tools UI shows fundamental snapshot card, accumulation card with foreign+domestic flow labels, and news section with cache origin badge.
- `/guidance` is a comprehensive member-only guidance page with modern UI redesign featuring sticky section navigation with solid gradient background (z-index 50, 98% opacity, 24px backdrop-blur) to prevent text overlap, collapsible feature sections with progressive disclosure, quick action cards linking to main features, step-by-step workflow guide, visual info boxes (info/warning/success types), timeframe reference table, and enhanced accessibility (ARIA labels, semantic HTML, keyboard navigation). Layout optimized for mobile with horizontal scrollable nav, full-width CTAs, and responsive grid layouts. Content restructured into clear sections: Mulai (quick start), Filosofi (philosophy), Fitur (features), Workflow (daily workflow), and Tips (best practices and common mistakes).
- `/` dashboard has comprehensive UX improvements: simplified hero copy (shorter headlines, "kamu" voice, 15-20 word sentences), enhanced visual hierarchy (space-y-12/16/20 responsive spacing), improved glassmorphism (border-white/[0.08], bg-white/[0.02-0.04]), skeleton loading states for quotes/charts, full accessibility (skip link, ARIA labels, semantic HTML, focus-visible states with ring-2 ring-amber-300), mobile optimization (text-[2rem] sm:text-[2.8rem] lg:text-[4rem], min-h-11 touch targets, 60s→42s marquee speed), VIX insight box with actionable recommendations, IHSG quick insight (growth vs defensive), 2 new FAQ items (platform difference, data real-time explanation), consistent amber-300 accent color, enhanced modal animations (fade-in slide-in-from-bottom-4), and improved search UX (placeholder "Coba ketik COAL, GOTO...", "Populer:" label for quick chips).
