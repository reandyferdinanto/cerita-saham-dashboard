import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Superadmin has no DB record
  if (session.role === "superadmin") {
    return NextResponse.json({ error: "Superadmin cannot upload avatar" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File diperlukan" }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary belum dikonfigurasi" }, { status: 500 });
  }

  // Upload to Cloudinary via REST API
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const timestamp = Math.round(Date.now() / 1000);
  // Create signature
  const crypto = await import("crypto");
  const sigStr = `folder=cerita-saham-avatars&timestamp=${timestamp}&transformation=c_fill,h_200,w_200${apiSecret}`;
  const signature = crypto.createHash("sha1").update(sigStr).digest("hex");

  const uploadData = new FormData();
  uploadData.append("file", dataUri);
  uploadData.append("api_key", apiKey);
  uploadData.append("timestamp", timestamp.toString());
  uploadData.append("signature", signature);
  uploadData.append("folder", "cerita-saham-avatars");
  uploadData.append("transformation", "c_fill,h_200,w_200");

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: uploadData }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    console.error("Cloudinary error:", err);
    return NextResponse.json({ error: "Gagal upload gambar" }, { status: 500 });
  }

  const uploadJson = await uploadRes.json();
  const avatarUrl = uploadJson.secure_url as string;

  await connectDB();
  await User.findByIdAndUpdate(session.userId, { avatarUrl });

  // Refresh token with new avatarUrl
  const newToken = await signToken({ ...session, avatarUrl });

  const response = NextResponse.json({ success: true, avatarUrl });
  response.cookies.set("auth_token", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}

