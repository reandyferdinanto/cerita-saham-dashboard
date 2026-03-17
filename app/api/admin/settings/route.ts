import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { verifyToken } from "@/lib/auth";

const DEFAULT_INVESTOR_TOOLS = ["aiBrief", "riskCalculator", "rightsIssueCalculator", "stockSplitCalculator"];

// GET — public (used on register page to show prices & payment methods)
export async function GET() {
  try {
    await connectDB();
    let settings = await SiteSettings.findOne({});
    if (!settings) {
      // Seed default settings
      settings = await SiteSettings.create({
        membershipPrices: { "3months": 300000, "6months": 550000, "1year": 1100000 },
        paymentMethods: [
          { name: "BCA", type: "bank", accountNumber: "1234567890", accountName: "Cerita Saham" },
          { name: "OVO", type: "emoney", accountNumber: "08123456789", accountName: "Cerita Saham" },
        ],
        enabledInvestorTools: DEFAULT_INVESTOR_TOOLS,
      });
    }
    if (!Array.isArray(settings.enabledInvestorTools) || settings.enabledInvestorTools.length === 0) {
      settings.enabledInvestorTools = DEFAULT_INVESTOR_TOOLS;
      await settings.save();
    }
    return NextResponse.json(settings.toObject());
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
    await connectDB();
    const existingSettings = await SiteSettings.findOne({});

    const settings = await SiteSettings.findOneAndUpdate(
      {},
      {
        $set: {
          membershipPrices: body.membershipPrices,
          paymentMethods: body.paymentMethods,
          enabledInvestorTools:
            Array.isArray(body.enabledInvestorTools) && body.enabledInvestorTools.length > 0
              ? body.enabledInvestorTools
              : existingSettings?.enabledInvestorTools?.length
                ? existingSettings.enabledInvestorTools
                : DEFAULT_INVESTOR_TOOLS,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

