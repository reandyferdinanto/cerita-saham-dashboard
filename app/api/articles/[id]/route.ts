import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { verifyToken } from "@/lib/auth";
import "@/lib/models/User";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    const article = await Article.findById(id).populate("authorId", "name");
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    // If the article is private, we need to ensure the user is logged in
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
