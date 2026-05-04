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
