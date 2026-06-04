import { Schema, model, models, Document } from "mongoose";

export interface TickerMention {
  ticker: string;
  fullTicker: string;
  relevanceScore: number;
  mentionCount: number;
  isPrimary: boolean;
  confidence: number;
}

export interface ArticleMetadata {
  viewCount?: number;
  bookmarkCount?: number;
  sentiment?: "positive" | "negative" | "neutral";
  sentimentScore?: number;
  impactLevel?: "high" | "medium" | "low";
  articleType?: "earnings" | "ma" | "regulatory" | "market_analysis" | "general";
  sectors?: string[];
  processedAt?: Date;
  tickerExtractionVersion?: string;
}

export interface IArticle extends Document {
  title: string;
  content: string; // The article body, supporting paragraphs
  imageUrl?: string | null;
  isPublic: boolean;
  authorId?: Schema.Types.ObjectId | null;
  
  // Enhanced fields for ticker-article linking
  extractedTickers?: TickerMention[];
  metadata?: ArticleMetadata;
  
  createdAt: Date;
  updatedAt: Date;
}

const TickerMentionSchema = new Schema({
  ticker: { type: String, required: true },
  fullTicker: { type: String, required: true },
  relevanceScore: { type: Number, default: 0 },
  mentionCount: { type: Number, default: 0 },
  isPrimary: { type: Boolean, default: false },
  confidence: { type: Number, default: 0 },
}, { _id: false });

const ArticleMetadataSchema = new Schema({
  viewCount: { type: Number, default: 0 },
  bookmarkCount: { type: Number, default: 0 },
  sentiment: { type: String, enum: ["positive", "negative", "neutral"], default: "neutral" },
  sentimentScore: { type: Number, default: 0 },
  impactLevel: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  articleType: { type: String, enum: ["earnings", "ma", "regulatory", "market_analysis", "general"], default: "general" },
  sectors: [{ type: String }],
  processedAt: { type: Date },
  tickerExtractionVersion: { type: String, default: "1.0" },
}, { _id: false });

const ArticleSchema = new Schema<IArticle>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Made optional for superadmin
    },
    extractedTickers: {
      type: [TickerMentionSchema],
      default: [],
    },
    metadata: {
      type: ArticleMetadataSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
ArticleSchema.index({ "extractedTickers.ticker": 1 });
ArticleSchema.index({ "extractedTickers.isPrimary": 1 });
ArticleSchema.index({ "metadata.sectors": 1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ "metadata.viewCount": -1 });

const Article = models.Article || model<IArticle>("Article", ArticleSchema);
export default Article;

// Made with Bob
