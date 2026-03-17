import { Document, Schema, model, models } from "mongoose";

export type CorporateActionType = "dividend" | "rights_issue" | "stock_split" | "buyback" | "rups" | "earnings" | "other";
export type CorporateActionStatus = "upcoming" | "watching" | "done";

export interface ICorporateAction extends Document {
  userId: string;
  ticker: string;
  title: string;
  actionType: CorporateActionType;
  actionDate: Date;
  status: CorporateActionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CorporateActionSchema = new Schema<ICorporateAction>(
  {
    userId: { type: String, required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    actionType: {
      type: String,
      enum: ["dividend", "rights_issue", "stock_split", "buyback", "rups", "earnings", "other"],
      default: "other",
    },
    actionDate: { type: Date, required: true },
    status: { type: String, enum: ["upcoming", "watching", "done"], default: "upcoming" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const CorporateAction =
  models.CorporateAction || model<ICorporateAction>("CorporateAction", CorporateActionSchema);

export default CorporateAction;