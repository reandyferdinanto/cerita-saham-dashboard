import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/adminSession";
import { createArticleRecord, listArticles } from "@/lib/data/articles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const articles = await listArticles({ includePrivate: true, adminView: true });
    return NextResponse.json(articles, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
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
    const authorId = session.userId === "superadmin" ? null : session.userId;

    const article = await createArticleRecord({
      title: body.title,
      content: body.content,
      imageUrl: body.imageUrl || null,
      isPublic: body.isPublic || false,
      authorId,
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error("POST article error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}