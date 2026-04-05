import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listArticles } from "@/lib/data/articles";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth_token")?.value;
    let isLoggedIn = false;

    if (token) {
      const session = await verifyToken(token);
      if (session) {
        isLoggedIn = true;
      }
    }

    const articles = await listArticles({ includePrivate: isLoggedIn, adminView: false });
    return NextResponse.json(articles);
  } catch (error) {
    console.error("GET public articles error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}