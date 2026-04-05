import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import Article from "@/lib/models/Article";
import { runWithDatabasePreference } from "@/lib/data/provider";
import { type ArticleInput, type PlainArticle } from "@/lib/data/shared";

function toPlainArticle(doc: Record<string, unknown>): PlainArticle {
  return {
    _id: String(doc._id ?? doc.id),
    title: String(doc.title),
    content: String(doc.content),
    imageUrl: doc.imageUrl == null ? null : String(doc.imageUrl),
    isPublic: Boolean(doc.isPublic),
    authorId: doc.authorId == null ? null : String(doc.authorId),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(String(doc.createdAt)),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(String(doc.updatedAt)),
  };
}

function mapArticleAuthor(authorName: string | null | undefined, authorEmail?: string | null) {
  if (!authorName && !authorEmail) return null;
  return {
    name: authorName ?? null,
    email: authorEmail ?? null,
  };
}

export async function listArticles(args?: { includePrivate?: boolean; adminView?: boolean }) {
  return runWithDatabasePreference(
    "listArticles",
    async () => {
      const where = args?.includePrivate ? "" : "where a.is_public = true";
      const result = await queryPostgres<{
        id: string;
        title: string;
        content: string;
        image_url: string | null;
        is_public: boolean;
        author_id: string | null;
        created_at: Date;
        updated_at: Date;
        author_name: string | null;
        author_email: string | null;
      }>(
        `select a.id, a.title, a.content, a.image_url, a.is_public, a.author_id, a.created_at, a.updated_at,
                u.name as author_name, u.email as author_email
         from articles a
         left join users u on u.id = a.author_id
         ${where}
         order by a.created_at desc`
      );

      return result.rows.map((row) => ({
        _id: row.id,
        title: row.title,
        content: row.content,
        imageUrl: row.image_url,
        isPublic: row.is_public,
        authorId: mapArticleAuthor(row.author_name, args?.adminView ? row.author_email : null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
    async () => {
      await connectDB();
      const query = args?.includePrivate ? {} : { isPublic: true };
      const articles = await Article.find(query)
        .sort({ createdAt: -1 })
        .populate("authorId", args?.adminView ? "name email" : "name");
      return articles.map((article) => ({ ...article.toObject(), _id: String(article._id) }));
    }
  );
}

export async function findArticleById(id: string) {
  return runWithDatabasePreference(
    "findArticleById",
    async () => {
      const result = await queryPostgres<{
        id: string;
        title: string;
        content: string;
        image_url: string | null;
        is_public: boolean;
        author_id: string | null;
        created_at: Date;
        updated_at: Date;
        author_name: string | null;
        author_email: string | null;
      }>(
        `select a.id, a.title, a.content, a.image_url, a.is_public, a.author_id, a.created_at, a.updated_at,
                u.name as author_name, u.email as author_email
         from articles a
         left join users u on u.id = a.author_id
         where a.id = $1
         limit 1`,
        [id]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        _id: row.id,
        title: row.title,
        content: row.content,
        imageUrl: row.image_url,
        isPublic: row.is_public,
        authorId: mapArticleAuthor(row.author_name, row.author_email),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    async () => {
      await connectDB();
      const article = await Article.findById(id).populate("authorId", "name email");
      return article ? { ...article.toObject(), _id: String(article._id) } : null;
    }
  );
}

export async function createArticleRecord(input: {
  title: string;
  content: string;
  imageUrl: string | null;
  isPublic: boolean;
  authorId?: string | null;
}) {
  return runWithDatabasePreference(
    "createArticleRecord",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `insert into articles (id, title, content, image_url, is_public, author_id)
         values ($1,$2,$3,$4,$5,$6)
         returning id, title, content, image_url as "imageUrl", is_public as "isPublic",
                   author_id as "authorId", created_at as "createdAt", updated_at as "updatedAt"`,
        [randomUUID(), input.title, input.content, input.imageUrl, input.isPublic, input.authorId ?? null]
      );
      return toPlainArticle(result.rows[0]);
    },
    async () => {
      await connectDB();
      const article = await Article.create({
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl,
        isPublic: input.isPublic,
        authorId: input.authorId ?? undefined,
      });
      return toPlainArticle(article.toObject() as unknown as Record<string, unknown>);
    }
  );
}

export async function updateArticleRecord(id: string, input: ArticleInput) {
  return runWithDatabasePreference(
    "updateArticleRecord",
    async () => {
      const existing = await queryPostgres<{ author_id: string | null }>(
        `select author_id from articles where id = $1 limit 1`,
        [id]
      );
      const authorId = existing.rows[0]?.author_id ?? null;
      const result = await queryPostgres<Record<string, unknown>>(
        `update articles
         set title = $2, content = $3, image_url = $4, is_public = $5, author_id = $6, updated_at = now()
         where id = $1
         returning id, title, content, image_url as "imageUrl", is_public as "isPublic",
                   author_id as "authorId", created_at as "createdAt", updated_at as "updatedAt"`,
        [id, input.title, input.content, input.imageUrl, input.isPublic, input.authorId ?? authorId]
      );
      return result.rows[0] ? toPlainArticle(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const nextSet: Record<string, unknown> = {
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl,
        isPublic: input.isPublic,
      };
      if (input.authorId !== undefined) {
        nextSet.authorId = input.authorId ?? undefined;
      }
      const article = await Article.findByIdAndUpdate(
        id,
        {
          $set: nextSet,
        },
        { new: true }
      );
      return article ? toPlainArticle(article.toObject() as unknown as Record<string, unknown>) : null;
    }
  );
}

export async function deleteArticleRecord(id: string) {
  return runWithDatabasePreference(
    "deleteArticleRecord",
    async () => {
      await queryPostgres(`delete from articles where id = $1`, [id]);
    },
    async () => {
      await connectDB();
      await Article.findByIdAndDelete(id);
    }
  );
}
