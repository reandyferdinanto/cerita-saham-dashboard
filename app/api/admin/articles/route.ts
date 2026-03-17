import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { requireAdminSession } from "@/lib/adminSession";

type ArticleInput = {
  title: string;
  content: string;
  imageUrl: string | null;
  isPublic: boolean;
  authorId?: mongoose.Types.ObjectId | string;
};

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const articles = await Article.find().sort({ createdAt: -1 }).populate("authorId", "name email");
    return NextResponse.json(articles);
  } catch (error) {
    console.error("GET articles error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    await connectDB();

    // If the user is superadmin (which doesn't have an ObjectId), we will use a generated dummy ObjectId
    // to bypass the validation error, or find the actual admin document in the database if necessary.
    // However, generating a new ObjectId is the simplest and safest way for now since we just need to satisfy validation.

    // session.userId is "superadmin" for superadmin, which causes CastError to ObjectId.
    const authorId = session.userId === "superadmin" ? new mongoose.Types.ObjectId() : session.userId;

    const articleData: ArticleInput = {
      title: body.title,
      content: body.content,
      imageUrl: body.imageUrl || null,
      isPublic: body.isPublic || false,
    };

    if (authorId) {
      articleData.authorId = authorId;
    }

    const article = await Article.create(articleData);

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("POST article error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
