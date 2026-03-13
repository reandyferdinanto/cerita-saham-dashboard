import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  let membershipStatus = session.membershipStatus || null;
  let role = session.role;
  let avatarUrl = session.avatarUrl;
  let membershipEndDate = session.membershipEndDate;

  // Fetch freshest data from DB to prevent stale JWT issues
  if (session.userId !== "superadmin") {
    try {
      await connectDB();
      const user = await User.findById(session.userId).lean();
      if (user) {
        membershipStatus = user.membershipStatus;
        role = user.role;
        avatarUrl = user.avatarUrl;
        membershipEndDate = user.membershipEndDate ? (user.membershipEndDate as Date).toISOString() : null;
      }
    } catch (e) {
      console.error("Failed to fetch fresh user in /me:", e);
    }
  }

  // Auto-check if membership has expired
  if (
    membershipStatus === "active" &&
    membershipEndDate &&
    new Date(membershipEndDate) < new Date()
  ) {
    membershipStatus = "expired";
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      role,
      avatarUrl: avatarUrl || null,
      membershipStatus,
      membershipEndDate: membershipEndDate || null,
    },
  });
}
