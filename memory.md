# Cerita Saham Memory

Last updated: 2026-04-01

## Purpose
- Quick project memory for future work.
- Read this before making non-trivial changes.
- Update this file every time architecture, route behavior, data model, auth, API contract, or shared component behavior changes.

## Stack
- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Mongoose + MongoDB
- JWT auth via cookie `auth_token`
- Yahoo Finance as market data source
- Framer Motion + lightweight-charts for UI/chart interactions
- React Markdown for article rendering

## High-Level Architecture
- `app/`: App Router pages and API routes
- `components/`: reusable UI, charts, watchlist UI
- `lib/`: data access, auth/session helpers, technical analysis engine, Yahoo integration
- `lib/models/`: Mongoose models
- `scripts/`: maintenance/migration/env check scripts
- `middleware.ts`: route protection by auth, role, and membership status

## Core Product Areas
- Public dashboard with IHSG, global indices, news, and articles
- Auth + membership flow
- Stock search and stock detail analysis
- Watchlist with TP/SL/bandarmology notes
- Investor tools (AI brief, risk, rights issue, stock split)
- Guidance/education pages
- Trading simulation page
- Admin panel for watchlist, articles, users/membership, settings

## Auth and Access Rules
- Session token stored in cookie `auth_token`
- Roles: `user`, `admin`, `superadmin`
- Membership-aware protected UI routes: `/search`, `/watchlist`, `/guidance`, `/stock`
- Admin UI routes: `/admin*`
- `superadmin` required for `/api/admin*` except public settings read and special middleware exceptions
- `/api/watchlist`:
  - `GET` is public
  - non-`GET` requires `admin` or `superadmin`
- Expired active membership is auto-treated as `expired` in middleware and redirected to `/pending`

## Route Map
### Public / mixed pages
- `/`: dashboard overview, IHSG chart, news, articles, quick navigation
- `/login`: login with email + phone
- `/register`: membership registration and package selection
- `/pending`: payment waiting / expired / rejected / suspended state
- `/articles/[id]`: article detail, private article requires auth

### Member pages
- `/search`: IDX stock search, quote, chart, fundamentals, news, technical panel
- `/watchlist`: tracked stocks with quotes, sorting, TP/SL display
- `/stock/[ticker]`: dedicated stock detail page with chart + watchlist note overlay
- `/investor-tools`: AI brief, risk calculator, right issue calculator, stock split calculator
- `/guidance`: detailed beginner onboarding page aligned with actual app flows, access levels, Cerita Saham philosophy, market-reading basics, tool usage, and practical daily workflow
- `/simulation`: interactive trading simulator and money management education

### Admin pages
- `/admin`: unified admin control center with tabs for watchlist, articles, and member/settings management
- `/admin?tab=bandarmology`: admin-only ticker search + detailed bandarmology analysis panel using public price/volume data and a Ryan Filbert-inspired lens
- `/api/watchlist/bandarmology/screener`: admin-only screener shortlist for ideal IDX candidates under Ryan Filbert-inspired bandarmology presets
- `/admin/articles`: article management route still exists, but main admin navigation now centers on `/admin?tab=articles`
- `/admin/users`: member management route still exists, but main admin navigation now centers on `/admin?tab=members`

## Navigation Rules
- Main shared nav is in `components/ui/Navbar.tsx`
- Desktop nav shows role-based links
- Mobile bottom nav downgrades protected items to `/login` when logged out
- Admin pending membership badge is shown in navbar from `/api/admin/membership`
- Admin navigation is consolidated to one visible menu entry that opens the unified admin control center
- Admin control center includes a dedicated bandarmology analysis tab; this is an interpretive heuristic built from price/volume data, not broker summary data
- Admin bandarmology tab also includes a preset-based screener (`ideal`, `accumulation`, `breakout`, `demand`, `defensive`) for quick shortlist generation

## Shared Layout
- `app/layout.tsx` wraps app with:
  - `AuthProvider`
  - `NavbarWrapper`
  - `AdminAssistantPopup`
- Global fonts:
  - local fallback stacks via CSS variables for sans, mono, and serif display usage

## Key Shared Components
- `components/ui/AuthProvider.tsx`: client auth state, `useAuth()`
- `components/ui/Navbar.tsx`: desktop/mobile navigation + user menu
- `components/ui/GlassCard.tsx`: common surface wrapper used widely
- `components/ui/FundamentalSection.tsx`: stock fundamentals UI
- `components/ui/TechnicalSignalPanel.tsx`: renders output of technical signal engine
- `components/ui/TickerPill.tsx`: detects ticker mentions in text and opens quick modal
- `components/ui/AdminAssistantPopup.tsx`: admin-side assistant entry point
- `components/charts/LineChart.tsx`: area/line chart
- `components/charts/CandlestickChart.tsx`: candlestick chart with TP/SL overlay support
- `components/watchlist/AddStockForm.tsx`: add watchlist entry
- `components/watchlist/StockCard.tsx`: watchlist display card

## Data Flow Summary
- Market data:
  - `lib/yahooFinance.ts`
  - normalizes quote, history, and search from Yahoo Finance
  - manually computes `changePercent` to avoid feed inconsistency
  - `4h` history is emulated from Yahoo `1h` source data
- Watchlist:
  - `lib/watchlistStore.ts`
  - backed by MongoDB model `Watchlist`
- Auth/session:
  - `lib/auth.ts` signs/verifies JWT
  - `lib/session.ts` reads cookie session in server context
  - `lib/userSession.ts` and `lib/adminSession.ts` are API helpers
- Technical analysis:
  - `lib/technicalSignals.ts`
  - computes RSI, MACD, MA(5/20/50/200), support/resistance, weighted BUY/SELL/WAIT score
- AI/article context:
  - `lib/adminArticleContext.ts`
  - builds stock/topic context from quote, technicals, and relevant news

## Main Models
- `User`
  - auth identity, role, avatar, membership status/duration/start/end/note
- `Watchlist`
  - ticker, name, TP, SL, bandarmology, addedAt
- `Article`
  - title, content, imageUrl, `isPublic`, author, timestamps
- `SiteSettings`
  - membership prices, payment methods, enabled investor tools
- `PortfolioHolding`
  - investor portfolio items
- `TradeJournalEntry`
  - trading journal entries
- `StockAlert`
  - investor alert items
- `CorporateAction`
  - investor corporate action tracking

## API Groups
### Auth
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/upload-avatar`

### Market data
- `/api/stocks/quote/[ticker]`
- `/api/stocks/history/[ticker]`
- `/api/stocks/search/[query]`
- `/api/stocks/fundamental/[ticker]`
- `/api/stocks/top-gainers`

### News and articles
- `/api/news`
- `/api/news/stock/[ticker]`
- `/api/articles`
- `/api/articles/[id]`
- `/api/admin/articles`
- `/api/admin/articles/[id]`
- `/api/admin/articles/ai`
- Admin article list should be fetched with `cache: "no-store"`; route is forced dynamic to avoid stale list after create/update/delete.
- Admin article editor supports `manual` mode and AI-assisted draft expansion mode; AI article context is filtered to Indonesia stock exchange / IDX / IHSG relevant news and aims for news-style structure: pembukaan, inti, kesimpulan.

### Watchlist
- `/api/watchlist`
- `/api/watchlist/[ticker]`

### Investor tools / member workspace
- `/api/investor/ai-brief`
- `/api/investor/risk`
- `/api/investor/screener`
- `/api/investor/portfolio`
- `/api/investor/portfolio/[id]`
- `/api/investor/journal`
- `/api/investor/journal/[id]`
- `/api/investor/alerts`
- `/api/investor/alerts/[id]`
- `/api/investor/corporate-actions`
- `/api/investor/corporate-actions/[id]`

### Admin and ops
- `/api/admin/membership`
- `/api/admin/users`
- `/api/admin/settings`
- `/api/admin/assistant`
- `/api/admin/migrate-watchlist`
- `/api/cron/daily-summary`

## Important Settings / Env Vars
- `MONGODB_URI`
- `MONGODB_URI_DIRECT`
- `JWT_SECRET`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PHONE`
- `GROQ_API_KEY`
- `GROQ_ARTICLE_MODEL`
- `GROQ_BRIEF_MODEL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CRON_SECRET`
- `BROKER_SUMMARY_SOURCE_URL`

## Current Product Conventions
- IDX stocks usually normalized with `.JK`
- Most market pages are client components and poll periodically
- Yahoo quote/history endpoints are central to charts and stock pages
- Settings are stored in DB and used by register, pending, and admin pages
- Investor tools visibility is configurable from admin settings
- Articles can be public or private
- Admin bandarmology analysis now includes a mini annotated chart driven by `/api/watchlist/bandarmology`, with price, MA20/MA50, support, resistance, breakout, and explanation markers
- Admin bandarmology screener now includes research-based presets from the attached trading report: `Trend Pullback`, `Breakout Volume`, and `Trend Position`, and each result can jump into the full analysis view with the same mini chart
- Admin bandarmology screener UI is split into two preset groups (`Preset Cepat` and `Preset Riset`) plus an active-preset summary card to reduce overlap and make scan mode easier to read
- Admin bandarmology screener now scans a broader curated IDX universe (not just the initial big-cap list), and the UI explicitly shows the current curated universe size so users do not mistake it for a full IDX screener
- Admin bandarmology screener supports explicit price buckets (`all`, `<200`, `200-500`, `>500`) and the research presets were tightened to reduce overlap with the core Ryan Filbert-style presets
- Member screener (`/api/investor/screener`) now reuses the same shared bandarmology shortlist engine as admin, with mapped presets plus shared accumulation/breakout bias fields instead of the old small hardcoded universe
- `Trend Pullback` research preset now uses looser thresholds for `<200` stocks (price vs MA, RSI, volume, demand) so low-priced candidates are not filtered out by big-cap-biased rules
- There is now a DB-backed Indonesia stock master (`IndonesiaStock`) synced from a broad IDX list source, and the bandarmology screener uses that DB list as its prefilter universe before running deep analysis on a smaller candidate subset
- Indonesia stock master sync is tolerant of partial source failures: if early pages succeed and a later page fails, the sync keeps the rows already collected instead of failing the whole screener
- Admin bandarmology panel now shows stock master status (`activeCount`, `last sync`, source link) and provides a `Sync Ulang Stock Master` action that refreshes the screener after sync
- Bandarmology phase detection now distinguishes more early-stage structures such as `Trend pullback sehat`, `Base building`, `Reclaim awal`, and `False breakout risk` so analysis is not limited to pure markup/markdown states
- Admin control center now exposes `Stock Summary` instead of `Broker Summary`; the stock summary panel handles IDX `.xlsx` upload, accumulation shortlist, and price-vs-flow visualization
- `Stock Summary` parser now accepts both English and Indonesian IDX headers, including variants like `Stock Code`/`Kode Saham`, `Company Name`/`Nama Perusahaan`, `Open Price`/`Harga Pembukaan`, `Close`/`Harga Penutupan`, `Value`/`Nilai`, and `Foreign Buy/Sell`/`Asing Beli/Jual`
- IDX summary uploads now support `.xlsx` / `.xlsm` parsing on the server via a lightweight workbook reader in `lib/xlsxWorkbook.ts`; trade date can be inferred from filenames like `Stock Summary-20260331.xlsx`
- For `Stock Summary` uploads, the filename date now takes priority over the manual date field when a pattern like `Stock Summary-20260331.xlsx` or `Ringkasan Saham-20260402.xlsx` is detected; the upload UI also auto-fills the date from the filename
- `Stock Summary` admin mode now includes an accumulation shortlist for stocks that show foreign support, stronger bid than offer, active liquidity, and closes near the daily high; the current day remains the anchor, but the scorer now also checks consistency over the last 3-5 trading days via `/api/admin/stock-summary/analysis`
- The `Stock Summary` accumulation shortlist now exposes a `Conviction Score Smart Money` plus label (`Awal`, `Menarik`, `Kuat`, `Sangat Kuat`) so candidates are ranked by stronger combined evidence of accumulation + readiness
- Stock Summary accumulation scoring now mixes absolute liquidity/foreign thresholds with relative flow-to-value checks so lower-priced and mid-cap names are less penalized versus big caps
- `Stock Summary` now also provides a ticker chart section that overlays Yahoo Finance daily candlesticks with two line series derived from stock summary history: `Akumulasi Lokal` and `Akumulasi Foreign`; API lives at `/api/admin/stock-summary/series`
- Admin trading workflow now supports query-param deep links between `Stock Summary`, `Bandarmology`, and `Watchlist`, including draft watchlist prefills (`prefillTicker`, `prefillName`, `prefillTp`, `prefillSl`, `prefillNote`) and direct ticker handoff via `/admin?tab=bandarmology&ticker=...` or `/admin?tab=stock-summary&ticker=...`
- `Stock Summary` admin route now supports deletion workflows via `DELETE /api/admin/stock-summary`: delete all data with `scope=all` or delete one trading date with `scope=date&date=YYYY-MM-DD`; the admin panel exposes both controls
- Stock Summary admin browsing now centers on a weekly calendar strip backed by GET /api/admin/stock-summary?view=dates, so admins can jump to the latest available trading date when today's IDX file has not been uploaded yet
- Manual text import for Stock Summary has been removed from the admin workflow; imports are now upload-first through /api/admin/stock-summary using IDX files or text file uploads

## Files To Check First For Common Changes
- Routing/access issue: `middleware.ts`, `components/ui/Navbar.tsx`
- Auth issue: `lib/auth.ts`, `lib/session.ts`, `components/ui/AuthProvider.tsx`
- Market data issue: `lib/yahooFinance.ts`, `app/api/stocks/*`
- Watchlist issue: `lib/watchlistStore.ts`, `app/api/watchlist/*`, `app/watchlist/page.tsx`, `app/admin/page.tsx`
- Article issue: `app/admin/articles/page.tsx`, `app/api/admin/articles/*`, `app/articles/[id]/page.tsx`
- Membership/settings issue: `app/admin/users/page.tsx`, `app/api/admin/membership/route.ts`, `app/api/admin/settings/route.ts`
- Technical analysis issue: `lib/technicalSignals.ts`, `components/ui/TechnicalSignalPanel.tsx`
- Indonesia stock master / screener universe issue: `lib/indonesiaStockMaster.ts`, `lib/models/IndonesiaStock.ts`, `app/api/admin/stocks/master/route.ts`, `app/api/watchlist/bandarmology/screener/route.ts`
- Stock summary admin issue: `lib/stockSummary.ts`, `lib/models/StockSummaryRow.ts`, `app/api/admin/stock-summary/route.ts`, `app/admin/AdminStockSummaryPanel.tsx`, `lib/xlsxWorkbook.ts`
- Stock summary analysis issue: `lib/stockSummaryAnalysis.ts`, `app/api/admin/stock-summary/analysis/route.ts`, `app/api/admin/stock-summary/series/route.ts`, `app/admin/AdminStockSummaryPanel.tsx`, `app/admin/StockSummaryAccumulationChart.tsx`

## Memory Update Rules
- Update this file whenever any of these change:
  - route added/removed/repurposed
  - middleware/auth/role logic
  - API contract or endpoint ownership
  - shared component responsibility
  - model/schema shape
  - env var requirements
  - major product workflow
- Keep updates short and factual.
- Prefer editing existing sections instead of adding long prose.
- If a change is local and not architectural, no need to expand this file unnecessarily.

## Update Checklist
- Did route/access behavior change?
- Did API request/response shape change?
- Did DB schema/model meaning change?
- Did shared component responsibility change?
- Did admin/member workflow change?
- Did setup/env requirements change?

## Working Note For Future Tasks
- Before coding: read this file.
- After coding: if behavior/architecture changed, update this file in the same task.






