import { NextResponse } from "next/server";
import { getQuote } from "@/lib/yahooFinance";
import { getIndonesiaStockUniverse } from "@/lib/indonesiaStockMaster";

export async function GET() {
  try {
    const universe = await getIndonesiaStockUniverse({ priceBucket: "all", candidateLimit: 180 });
    const tickers = universe.stocks.map((stock) => stock.ticker).slice(0, 180);

    const quotes = await Promise.all(
      tickers.map((ticker) => getQuote(ticker).catch(() => null))
    );

    const topGainers = quotes
      .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote && quote.changePercent !== undefined && quote.price > 0))
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 40)
      .map((quote) => ({
        ticker: quote.ticker.replace(".JK", ""),
        name: quote.name,
        price: quote.price,
        changePercent: quote.changePercent,
      }));

    return NextResponse.json(topGainers);
  } catch (error) {
    console.error("Top gainers error:", error);
    return NextResponse.json([], { status: 200 });
  }
}