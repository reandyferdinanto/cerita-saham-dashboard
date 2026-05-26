import { Document, Schema, model, models } from "mongoose";

export interface INewsArticle extends Document {
  ticker: string; // Normalized uppercase, no .JK suffix
  title: string;
  link: string;
  source: string;
  pubDate: Date;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  sentimentReason: string;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsArticleSchema = new Schema<INewsArticle>(
  {
    ticker: { type: String, required: true, uppercase: true, trim: true, index: true },
    title: { type: String, required: true },
    link: { type: String, required: true },
    source: { type: String, default: "" },
    pubDate: { type: Date, required: true, index: true },
    description: { type: String, default: "" },
    sentiment: { type: String, enum: ["positive", "negative", "neutral"], default: "neutral" },
    sentimentScore: { type: Number, default: 0 },
    sentimentReason: { type: String, default: "" },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Unique compound index: same link can be cached once per ticker
NewsArticleSchema.index({ ticker: 1, link: 1 }, { unique: true });
// Sort index for "latest first" queries
NewsArticleSchema.index({ ticker: 1, pubDate: -1 });
// TTL index: auto-delete documents 30 days after `fetchedAt`
NewsArticleSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const NewsArticle = models.NewsArticle || model<INewsArticle>("NewsArticle", NewsArticleSchema);
export default NewsArticle;
