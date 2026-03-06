import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ user: null }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  // Auto-check if membership has expired
  let membershipStatus = session.membershipStatus || null;
  if (
    membershipStatus === "active" &&
    session.membershipEndDate &&
    new Date(session.membershipEndDate) < new Date()
  ) {
    membershipStatus = "expired";
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
      avatarUrl: session.avatarUrl || null,
      membershipStatus,
      membershipEndDate: session.membershipEndDate || null,
    },
  });
}
