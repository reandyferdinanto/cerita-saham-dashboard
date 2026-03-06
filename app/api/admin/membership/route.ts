import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

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

  await connectDB();

  // Auto-expire anyone whose end date has passed
  await User.updateMany(
    { membershipStatus: "active", membershipEndDate: { $lt: new Date() } },
    { $set: { membershipStatus: "expired" } }
  );

  const users = await User.find({ role: { $ne: "superadmin" } })
    .select("email name role avatarUrl membershipStatus membershipDuration membershipStartDate membershipEndDate membershipNote createdAt")
    .sort({ createdAt: -1 })
    .lean();

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

  await connectDB();
  const user = await User.findById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role === "superadmin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  if (action === "activate") {
    const duration = user.membershipDuration || "3months";
    const endDate = addDuration(now, duration);
    await User.findByIdAndUpdate(userId, {
      membershipStatus: "active",
      membershipStartDate: now,
      membershipEndDate: endDate,
      membershipNote: note || null,
    });
  } else if (action === "deactivate") {
    await User.findByIdAndUpdate(userId, {
      membershipStatus: "expired",
      membershipNote: note || null,
    });
  } else if (action === "suspend") {
    await User.findByIdAndUpdate(userId, {
      membershipStatus: "suspended",
      membershipNote: note || "Suspended by admin",
    });
  } else if (action === "reject") {
    await User.findByIdAndUpdate(userId, {
      membershipStatus: "rejected",
      membershipNote: note || null,
    });
  } else if (action === "reset_pending") {
    await User.findByIdAndUpdate(userId, {
      membershipStatus: "pending",
      membershipNote: note || null,
    });
  } else if (action === "promote") {
    await User.findByIdAndUpdate(userId, { role: "admin" });
  } else if (action === "demote") {
    await User.findByIdAndUpdate(userId, { role: "user" });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const updated = await User.findById(userId).lean();
  return NextResponse.json({ success: true, user: updated });
}

