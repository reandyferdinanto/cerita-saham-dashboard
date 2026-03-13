import { Schema, model, models, Document } from "mongoose";

export interface IArticle extends Document {
  title: string;
  content: string; // The article body, supporting paragraphs
  imageUrl?: string | null;
  isPublic: boolean;
  authorId?: Schema.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

const Article = models.Article || model<IArticle>("Article", ArticleSchema);
export default Article;
