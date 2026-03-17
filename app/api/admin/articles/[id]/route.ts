import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { requireAdminSession } from "@/lib/adminSession";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    await connectDB();
    
    const { id } = await params;
    
    const article = await Article.findByIdAndUpdate(
      id,
      {
        $set: {
          title: body.title,
          content: body.content,
          imageUrl: body.imageUrl || null,
          isPublic: body.isPublic ?? false,
        },
      },
      { new: true }
    );

    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json(article);
  } catch (error) {
    console.error("PUT article error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const article = await Article.findByIdAndDelete(id);
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json({ message: "Article deleted" });
  } catch (error) {
    console.error("DELETE article error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
