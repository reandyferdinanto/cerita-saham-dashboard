import { NextRequest, NextResponse } from "next/server";

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
    // ── quoteSummary — holders + recommendations ─────────────────────────────
    let majorHolders: {
      insidersPercentHeld: number | null;
      institutionsPercentHeld: number | null;
      institutionsFloatPercentHeld: number | null;
      institutionsCount: number | null;
    } | null = null;

    let topInstitutions: {
      name: string;
      pctHeld: number;
      shares: number;
      value: number;
    }[] = [];

    let topInsiders: {
      name: string;
      relation: string;
      shares: number;
      pctHeld: number | null;
    }[] = [];

    let recommendationTrend: {
      period: string;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
    }[] = [];

    let upgradeHistory: {
      date: string;
      firm: string;
      toGrade: string;
      fromGrade: string;
      action: string;
    }[] = [];

    try {
      const summary = await yf.quoteSummary(ticker, {
        modules: [
          "majorHoldersBreakdown",
          "institutionOwnership",
          "insiderHolders",
          "recommendationTrend",
          "upgradeDowngradeHistory",
        ],
      });

      // Major holders breakdown
      const mh = (summary as any).majorHoldersBreakdown;
      if (mh) {
        majorHolders = {
          insidersPercentHeld: mh.insidersPercentHeld ?? null,
          institutionsPercentHeld: mh.institutionsPercentHeld ?? null,
          institutionsFloatPercentHeld: mh.institutionsFloatPercentHeld ?? null,
          institutionsCount: mh.institutionsCount ?? null,
        };
      }

      // Top institutional holders
      const io = (summary as any).institutionOwnership?.ownershipList || [];
      topInstitutions = io.slice(0, 8).map((h: any) => ({
        name: h.organization || "",
        pctHeld: h.pctHeld ?? 0,
        shares: h.position ?? 0,
        value: h.value ?? 0,
      }));

      // Top insider holders
      const ih = (summary as any).insiderHolders?.holders || [];
      topInsiders = ih.slice(0, 8).map((h: any) => ({
        name: h.name || "",
        relation: h.relation || "",
        shares: h.positionDirect ?? h.positionIndirect ?? 0,
        pctHeld: h.positionDirectDate ? null : null, // Yahoo doesn't expose % per insider
      }));

      // Recommendation trend (last 4 periods)
      const rt = (summary as any).recommendationTrend?.trend || [];
      recommendationTrend = rt.slice(0, 4).map((t: any) => ({
        period: t.period || "",
        strongBuy: t.strongBuy ?? 0,
        buy: t.buy ?? 0,
        hold: t.hold ?? 0,
        sell: t.sell ?? 0,
        strongSell: t.strongSell ?? 0,
      }));

      // Upgrade/downgrade history (last 10)
      const uh = (summary as any).upgradeDowngradeHistory?.history || [];
      upgradeHistory = uh.slice(0, 10).map((h: any) => ({
        date: h.epochGradeDate
          ? new Date(h.epochGradeDate * 1000).toISOString().split("T")[0]
          : "",
        firm: h.firm || "",
        toGrade: h.toGrade || "",
        fromGrade: h.fromGrade || "",
        action: h.action || "",
      }));
    } catch {
      // quoteSummary optional — some tickers (especially .JK) return partial data
    }

    return NextResponse.json({
      majorHolders,
      topInstitutions,
      topInsiders,
      recommendationTrend,
      upgradeHistory,
    });
  } catch (error) {
    console.error("Fundamental error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

