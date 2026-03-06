import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, phone } = await req.json();

    if (!email || !phone) {
      return NextResponse.json(
        { error: "Email dan nomor telepon diperlukan" },
        { status: 400 }
      );
    }

    // Superadmin shortcircuit
    const saEmail = process.env.SUPERADMIN_EMAIL;
    const saPhone = process.env.SUPERADMIN_PHONE;
    if (saEmail && saPhone && email.toLowerCase() === saEmail.toLowerCase() && phone === saPhone) {
      const token = await signToken({
        userId: "superadmin",
        email: saEmail,
        role: "superadmin",
        avatarUrl: null,
        membershipStatus: "active",
        membershipEndDate: null,
      });
      const response = NextResponse.json({
        success: true,
        user: { id: "superadmin", email: saEmail, role: "superadmin", membershipStatus: "active" },
      });
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return response;
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: "Email atau nomor telepon salah" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(phone, user.phoneHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Email atau nomor telepon salah" },
        { status: 401 }
      );
    }

    // Auto-expire membership if past end date
    let membershipStatus = user.membershipStatus;
    if (membershipStatus === "active" && user.membershipEndDate && user.membershipEndDate < new Date()) {
      membershipStatus = "expired";
      await User.findByIdAndUpdate(user._id, { membershipStatus: "expired" });
    }

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      membershipStatus,
      membershipEndDate: user.membershipEndDate?.toISOString() ?? null,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user._id, email: user.email, role: user.role, avatarUrl: user.avatarUrl, membershipStatus },
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
