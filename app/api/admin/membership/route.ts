import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  expireUsersWithPastMembership,
  findUserById,
  listUsersForAdmin,
  patchUserAdminFields,
} from "@/lib/data/users";

function addDuration(from: Date, duration: string): Date {
  const d = new Date(from);
  if (duration === "3months") d.setMonth(d.getMonth() + 3);
  else if (duration === "6months") d.setMonth(d.getMonth() + 6);
  else if (duration === "1year") d.setFullYear(d.getFullYear() + 1);
  return d;
}

// GET — list all non-superadmin users with membership info (admin+)
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await expireUsersWithPastMembership();
  const users = await listUsersForAdmin({ excludeSuperadmin: true });

  return NextResponse.json({ users });
}

// PATCH — activate / deactivate / suspend / reject
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, action, note } = await req.json();
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role === "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  if (action === "activate") {
    const duration = user.membershipDuration || "3months";
    const endDate = addDuration(now, duration);
    await patchUserAdminFields(userId, {
      membershipStatus: "active",
      membershipStartDate: now,
      membershipEndDate: endDate,
      membershipNote: note || null,
    });
  } else if (action === "deactivate") {
    await patchUserAdminFields(userId, {
      membershipStatus: "expired",
      membershipNote: note || null,
    });
  } else if (action === "suspend") {
    await patchUserAdminFields(userId, {
      membershipStatus: "suspended",
      membershipNote: note || "Suspended by admin",
    });
  } else if (action === "reject") {
    await patchUserAdminFields(userId, {
      membershipStatus: "rejected",
      membershipNote: note || null,
    });
  } else if (action === "reset_pending") {
    await patchUserAdminFields(userId, {
      membershipStatus: "pending",
      membershipNote: note || null,
    });
  } else if (action === "promote") {
    await patchUserAdminFields(userId, { role: "admin" });
  } else if (action === "demote") {
    await patchUserAdminFields(userId, { role: "user" });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const updated = await findUserById(userId);
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const { phoneHash: _phoneHash, ...safeUser } = updated;
  return NextResponse.json({ success: true, user: safeUser });
}

