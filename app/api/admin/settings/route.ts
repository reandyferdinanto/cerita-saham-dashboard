import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SiteSettings from "@/lib/models/SiteSettings";
import { verifyToken } from "@/lib/auth";

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
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — superadmin only
export async function PUT(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session || session.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    await connectDB();

    const settings = await SiteSettings.findOneAndUpdate(
      {},
      {
        $set: {
          membershipPrices: body.membershipPrices,
          paymentMethods: body.paymentMethods,
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

