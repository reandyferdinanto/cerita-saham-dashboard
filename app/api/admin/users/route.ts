import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

async function requireSuperAdmin(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session || session.role !== "superadmin") return null;
  return session;
}

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectDB();
  const users = await User.find({}, { phoneHash: 0 }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({ users });
}

// PATCH /api/admin/users — update user role
export async function PATCH(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, role } = await req.json();

  if (!userId || !["user", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectDB();
  const updated = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, select: "-phoneHash" }
  );

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: updated });
}

// DELETE /api/admin/users — delete a user
export async function DELETE(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await connectDB();
  await User.findByIdAndDelete(userId);
  return NextResponse.json({ success: true });
}

