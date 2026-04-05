import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { findArticleById } from "@/lib/data/articles";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const article = await findArticleById(id);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    if (!article.isPublic) {
      const token = req.cookies.get("auth_token")?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized. You must login to view this article." }, { status: 401 });
      }
      const session = await verifyToken(token);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized. You must login to view this article." }, { status: 401 });
      }
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("GET single article error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}