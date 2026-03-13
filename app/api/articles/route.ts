import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { verifyToken } from "@/lib/auth";
import "@/lib/models/User"; // Ensure User model is registered for populate

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    // Check if user is logged in
    const token = req.cookies.get("auth_token")?.value;
    let isLoggedIn = false;
    
    if (token) {
      const session = await verifyToken(token);
      if (session) {
        isLoggedIn = true;
      }
    }

    // If logged in, can see all articles. If not, only public.
    const query = isLoggedIn ? {} : { isPublic: true };
    
    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .populate("authorId", "name");

    return NextResponse.json(articles);
  } catch (error) {
    console.error("GET public articles error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
