import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import IndonesiaStock from "@/lib/models/IndonesiaStock";

// yahoo-finance2 v3
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YF = require("yahoo-finance2").default ?? require("yahoo-finance2");
const yf = new YF({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;

  try {
    let majorHolders: {
      insidersPercentHeld: number | null;
      institutionsPercentHeld: number | null;
      institutionsFloatPercentHeld: number | null;
      institutionsCount: number | null;
    } | null = null;

    let topInstitutions: { name: string; pctHeld: number; shares: number; value: number }[] = [];
    let topInsiders: { name: string; relation: string; shares: number; pctHeld: number | null }[] = [];
    let recommendationTrend: { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }[] = [];
    let upgradeHistory: { date: string; firm: string; toGrade: string; fromGrade: string; action: string }[] = [];

    // ── Valuation & Metrics ───────────────────────────────────────────────────
    let valuation: {
      marketCap: number | null;
      enterpriseValue: number | null;
      trailingPE: number | null;
      forwardPE: number | null;
      priceToBook: number | null;
      priceToSales: number | null;
      evToRevenue: number | null;
      evToEbitda: number | null;
      beta: number | null;
      dividendYield: number | null;
      payoutRatio: number | null;
      fiftyTwoWeekHigh: number | null;
      fiftyTwoWeekLow: number | null;
    } | null = null;

    // ── Financial Performance ─────────────────────────────────────────────────
    let financials: {
      revenue: number | null;
      revenueGrowth: number | null;
      grossMargin: number | null;
      ebitda: number | null;
      netIncome: number | null;
      profitMargin: number | null;
      operatingMargin: number | null;
      roe: number | null;
      roa: number | null;
      debtToEquity: number | null;
      currentRatio: number | null;
      freeCashflow: number | null;
      earningsGrowth: number | null;
    } | null = null;

    // ── Company Profile ───────────────────────────────────────────────────────
    let profile: {
      longName: string | null;
      sector: string | null;
      industry: string | null;
      website: string | null;
      longBusinessSummary: string | null;
      country: string | null;
      city: string | null;
      fullTimeEmployees: number | null;
    } | null = null;

    try {
      const summary = await yf.quoteSummary(ticker, {
        modules: [
          "majorHoldersBreakdown",
          "institutionOwnership",
          "insiderHolders",
          "recommendationTrend",
          "upgradeDowngradeHistory",
          "summaryDetail",
          "defaultKeyStatistics",
          "assetProfile",
          "financialData",
        ],
      });

      // Major holders
      const mh = (summary as any).majorHoldersBreakdown;
      if (mh) {
        majorHolders = {
          insidersPercentHeld: mh.insidersPercentHeld ?? null,
          institutionsPercentHeld: mh.institutionsPercentHeld ?? null,
          institutionsFloatPercentHeld: mh.institutionsFloatPercentHeld ?? null,
          institutionsCount: mh.institutionsCount ?? null,
        };
      }

      const io = (summary as any).institutionOwnership?.ownershipList || [];
      topInstitutions = io.slice(0, 8).map((h: any) => ({
        name: h.organization || "",
        pctHeld: h.pctHeld ?? 0,
        shares: h.position ?? 0,
        value: h.value ?? 0,
      }));

      const ih = (summary as any).insiderHolders?.holders || [];
      topInsiders = ih.slice(0, 8).map((h: any) => ({
        name: h.name || "",
        relation: h.relation || "",
        shares: h.positionDirect ?? h.positionIndirect ?? 0,
        pctHeld: null,
      }));

      const rt = (summary as any).recommendationTrend?.trend || [];
      recommendationTrend = rt.slice(0, 4).map((t: any) => ({
        period: t.period || "",
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      }));

      const uh = (summary as any).upgradeDowngradeHistory?.history || [];
      upgradeHistory = uh.slice(0, 10).map((h: any) => ({
        date: h.epochGradeDate ? new Date(h.epochGradeDate * 1000).toISOString().split("T")[0] : "",
        firm: h.firm || "",
        toGrade: h.toGrade || "",
        fromGrade: h.fromGrade || "",
        action: h.action || "",
      }));

      // Valuation — from summaryDetail + defaultKeyStatistics
      const sd = (summary as any).summaryDetail ?? {};
      const ks = (summary as any).defaultKeyStatistics ?? {};
      valuation = {
        marketCap: sd.marketCap ?? ks.marketCap ?? null,
        enterpriseValue: ks.enterpriseValue ?? null,
        trailingPE: sd.trailingPE ?? ks.trailingPE ?? null,
        forwardPE: sd.forwardPE ?? ks.forwardPE ?? null,
        priceToBook: ks.priceToBook ?? null,
        priceToSales: ks.priceToSalesTrailing12Months ?? null,
        evToRevenue: ks.enterpriseToRevenue ?? null,
        evToEbitda: ks.enterpriseToEbitda ?? null,
        beta: sd.beta ?? ks.beta ?? null,
        dividendYield: sd.dividendYield ?? sd.trailingAnnualDividendYield ?? null,
        payoutRatio: sd.payoutRatio ?? null,
        fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: sd.fiftyTwoWeekLow ?? null,
      };

      // Financial performance — from financialData
      const fd = (summary as any).financialData ?? {};
      financials = {
        revenue: fd.totalRevenue ?? null,
        revenueGrowth: fd.revenueGrowth ?? null,
        grossMargin: fd.grossMargins ?? null,
        ebitda: fd.ebitda ?? null,
        netIncome: fd.netIncomeToCommon ?? null,
        profitMargin: fd.profitMargins ?? null,
        operatingMargin: fd.operatingMargins ?? null,
        roe: fd.returnOnEquity ?? null,
        roa: fd.returnOnAssets ?? null,
        debtToEquity: fd.debtToEquity ?? null,
        currentRatio: fd.currentRatio ?? null,
        freeCashflow: fd.freeCashflow ?? null,
        earningsGrowth: fd.earningsGrowth ?? null,
      };

      // Company profile — from assetProfile
      const ap = (summary as any).assetProfile ?? {};
      profile = {
        longName: ap.longName ?? null,
        sector: ap.sector ?? null,
        industry: ap.industry ?? null,
        website: ap.website ?? null,
        longBusinessSummary: ap.longBusinessSummary ?? null,
        country: ap.country ?? null,
        city: ap.city ?? null,
        fullTimeEmployees: ap.fullTimeEmployees ?? null,
      };

    } catch {
      // quoteSummary optional
    }

    // ── Enrich with BEI Data from Local DB ────────────────────────────────────
    try {
      await connectDB();
      const symbol = ticker.replace(".JK", "").toUpperCase();
      const localStock: any = await IndonesiaStock.findOne({ symbol }).lean();
      
      if (localStock) {
        if (!profile) {
          profile = {
            longName: localStock.name,
            sector: localStock.sector,
            industry: localStock.industry,
            website: localStock.website,
            longBusinessSummary: localStock.description,
            country: "Indonesia",
            city: null,
            fullTimeEmployees: null
          };
        } else {
          // Prioritize local BEI data for these fields
          profile.sector = localStock.sector || profile.sector;
          profile.industry = localStock.industry || profile.industry;
          profile.website = localStock.website || profile.website;
          profile.longBusinessSummary = localStock.description || profile.longBusinessSummary;
          if (!profile.longName) profile.longName = localStock.name;
        }
      }
    } catch (dbErr) {
      console.error("Failed to enrich with local BEI data:", dbErr);
    }

    return NextResponse.json({
      majorHolders,
      topInstitutions,
      topInsiders,
      recommendationTrend,
      upgradeHistory,
      valuation,
      financials,
      profile,
    });
  } catch (error) {
    console.error("Fundamental error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
