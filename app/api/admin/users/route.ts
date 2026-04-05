import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  deleteUserRecord,
  listUsersForAdmin,
  patchUserAdminFields,
} from "@/lib/data/users";

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

  const users = await listUsersForAdmin();

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

  const updated = await patchUserAdminFields(userId, { role });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { phoneHash: _phoneHash, ...safeUser } = updated;
  return NextResponse.json({ success: true, user: safeUser });
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

  await deleteUserRecord(userId);
  return NextResponse.json({ success: true });
}

