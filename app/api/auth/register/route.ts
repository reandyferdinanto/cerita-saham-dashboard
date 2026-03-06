import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, phone, name, membershipDuration } = await req.json();

    if (!email || !phone) {
      return NextResponse.json(
        { error: "Email dan nomor telepon diperlukan" },
        { status: 400 }
      );
    }
    if (
      !membershipDuration ||
      !["3months", "6months", "1year"].includes(membershipDuration)
    ) {
      return NextResponse.json(
        { error: "Pilih durasi membership terlebih dahulu" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 }
      );
    }
    if (phone.length < 8) {
      return NextResponse.json(
        { error: "Nomor telepon minimal 8 digit" },
        { status: 400 }
      );
    }

    // Superadmin cannot register via this endpoint
    const saEmail = process.env.SUPERADMIN_EMAIL;
    const saPhone = process.env.SUPERADMIN_PHONE;
    if (
      saEmail &&
      saPhone &&
      email.toLowerCase() === saEmail.toLowerCase() &&
      phone === saPhone
    ) {
      return NextResponse.json(
        { error: "Akun ini sudah terdaftar" },
        { status: 409 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    const phoneHash = await bcrypt.hash(phone, 12);

    const user = await User.create({
      email: email.toLowerCase(),
      phoneHash,
      name: name || null,
      role: "user",
      membershipStatus: "pending",
      membershipDuration,
    });

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      membershipStatus: user.membershipStatus,
      membershipEndDate: null,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        membershipStatus: user.membershipStatus,
        membershipDuration: user.membershipDuration,
      },
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
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
