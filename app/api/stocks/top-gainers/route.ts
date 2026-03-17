import { NextResponse } from "next/server";
import { getQuote } from "@/lib/yahooFinance";

const IDX_LIQUID_TICKERS = [
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "BBNI.JK",
  "TLKM.JK",
  "ASII.JK",
  "AMMN.JK",
  "BREN.JK",
  "BYAN.JK",
  "GOTO.JK",
  "UNVR.JK",
  "ICBP.JK",
  "PGAS.JK",
  "BRPT.JK",
  "MEDC.JK",
  "ADRO.JK",
  "PTBA.JK",
  "ITMG.JK",
  "UNTR.JK",
  "AKRA.JK",
  "ANTM.JK",
  "INCO.JK",
  "MDKA.JK",
  "AMRT.JK",
  "CPIN.JK",
  "JPFA.JK",
  "KLBF.JK",
  "MAPI.JK",
  "ERAA.JK",
  "INET.JK",
];

export async function GET() {
  try {
    const quotes = await Promise.all(
      IDX_LIQUID_TICKERS.map((ticker) => getQuote(ticker).catch(() => null))
    );

    const topGainers = quotes
      .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote && quote.changePercent !== undefined))
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 10)
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
