import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import {
  createCorporateAction,
  listCorporateActions,
} from "@/lib/data/investorWorkspace";
import { listPortfolioHoldings } from "@/lib/data/investorWorkspace";
import { getAll as getWatchlist } from "@/lib/watchlistStore";

type AutoNewsItem = {
  title: string;
  pubDate: string;
  sentiment?: string;
  sentimentReason?: string;
};

type FundamentalSummary = {
  valuation?: {
    dividendYield?: number | null;
    payoutRatio?: number | null;
  } | null;
};

type AutoAction = {
  _id: string;
  ticker: string;
  title: string;
  actionType: string;
  actionDate: string;
  status: string;
  notes: string;
  source: "auto";
};

function detectActionType(title: string) {
  const lower = title.toLowerCase();
  if (/(dividen|dividend|cum date|ex date|recording date|payment date)/.test(lower)) return "dividend";
  if (/(rights issue|hmetd|rights)/.test(lower)) return "rights_issue";
  if (/(stock split|reverse stock)/.test(lower)) return "stock_split";
  if (/(buyback|buy back)/.test(lower)) return "buyback";
  if (/(rups|rapat umum pemegang saham|agms|egms)/.test(lower)) return "rups";
  if (/(earnings|kinerja|laba|pendapatan|kuartal)/.test(lower)) return "earnings";
  return null;
}

function detectStatus(title: string, actionType: string) {
  const lower = title.toLowerCase();

  if (actionType === "dividend") {
    if (/(cum date)/.test(lower)) return "cum-date";
    if (/(ex date)/.test(lower)) return "ex-date";
    if (/(recording date)/.test(lower)) return "recording-date";
    if (/(payment date|tanggal pembayaran)/.test(lower)) return "payment-date";
  }

  if (/(jadwal|akan|umumkan|proposal|rencana)/.test(lower)) return "upcoming";
  if (/(resmi|sudah|disetujui|ditetapkan|mencatat)/.test(lower)) return "watching";
  return "watching";
}

async function fetchFundamentalContext(origin: string, ticker: string) {
  try {
    const res = await fetch(`${origin}/api/stocks/fundamental/${encodeURIComponent(ticker)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FundamentalSummary;
    const dividendYield = data.valuation?.dividendYield ?? null;
    const payoutRatio = data.valuation?.payoutRatio ?? null;

    if (dividendYield == null && payoutRatio == null) {
      return null;
    }

    const details = [
      dividendYield != null ? `Dividend yield indikatif ${(dividendYield * 100).toFixed(2)}%` : "",
      payoutRatio != null ? `Payout ratio ${(payoutRatio * 100).toFixed(2)}%` : "",
    ].filter(Boolean);

    return details.join(". ");
  } catch {
    return null;
  }
}

async function buildAutoActions(origin: string, tickers: string[]) {
  const dedup = new Map<string, AutoAction>();

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const [newsRes, fundamentalContext] = await Promise.all([
          fetch(`${origin}/api/news/stock/${encodeURIComponent(ticker)}`, { cache: "no-store" }),
          fetchFundamentalContext(origin, ticker),
        ]);
        if (!newsRes.ok) return;
        const news = (await newsRes.json()) as AutoNewsItem[];

        news.slice(0, 10).forEach((item, index) => {
          const actionType = detectActionType(item.title);
          if (!actionType) return;

          const key = `${ticker}-${item.title}`;
          if (dedup.has(key)) return;

          const noteParts = [
            "Terdeteksi otomatis dari news terkait ticker ini.",
            item.sentimentReason ? `Sentimen: ${item.sentiment || "netral"} (${item.sentimentReason}).` : "",
            actionType === "dividend" && fundamentalContext ? fundamentalContext : "",
          ].filter(Boolean);

          dedup.set(key, {
            _id: `auto-${ticker}-${index}`,
            ticker,
            title: item.title,
            actionType,
            actionDate: item.pubDate || new Date().toISOString(),
            status: detectStatus(item.title, actionType),
            notes: noteParts.join(" "),
            source: "auto",
          });
        });
      } catch {
        return;
      }
    })
  );

  return [...dedup.values()];
}

export async function GET(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [manualActions, holdings, watchlist] = await Promise.all([
    listCorporateActions(session.userId),
    listPortfolioHoldings(session.userId),
    getWatchlist(),
  ]);

  const trackedTickers = [
    ...new Set([
      ...holdings.map((holding) => holding.ticker),
      ...watchlist.map((entry) => entry.ticker),
    ].filter(Boolean)),
  ];

  const autoActions = trackedTickers.length > 0 ? await buildAutoActions(req.nextUrl.origin, trackedTickers) : [];

  const merged = [
    ...manualActions.map((action) => ({ ...action, source: "manual" as const })),
    ...autoActions,
  ].sort((a, b) => new Date(a.actionDate).getTime() - new Date(b.actionDate).getTime());

  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const created = await createCorporateAction({
    userId: session.userId,
    ticker: String(body.ticker || "").toUpperCase(),
    title: body.title || "Aksi korporasi",
    actionType: body.actionType || "other",
    actionDate: body.actionDate,
    status: body.status || "upcoming",
    notes: body.notes || "",
  });

  return NextResponse.json({ ...created, source: "manual" }, { status: 201 });
}