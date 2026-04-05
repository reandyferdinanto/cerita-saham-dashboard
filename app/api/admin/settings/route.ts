import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getSiteSettingsRecord,
  updateSiteSettingsRecord,
} from "@/lib/data/settings";

const DEFAULT_INVESTOR_TOOLS = ["aiBrief", "riskCalculator", "rightsIssueCalculator", "stockSplitCalculator", "investorScreener"];

// GET — public (used on register page to show prices & payment methods)
export async function GET() {
  try {
    const settings = await getSiteSettingsRecord();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — admin or superadmin
export async function PUT(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const settings = await updateSiteSettingsRecord({
      membershipPrices: body.membershipPrices,
      paymentMethods: body.paymentMethods,
      enabledInvestorTools:
        Array.isArray(body.enabledInvestorTools) && body.enabledInvestorTools.length > 0
          ? body.enabledInvestorTools
          : DEFAULT_INVESTOR_TOOLS,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

