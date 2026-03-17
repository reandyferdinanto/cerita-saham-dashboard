import { Document, Schema, model, models } from "mongoose";

export type TradeSide = "buy" | "sell";
export type TradeStatus = "planned" | "open" | "closed" | "cancelled";

export interface ITradeJournalEntry extends Document {
  userId: string;
  ticker: string;
  setupName: string;
  side: TradeSide;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number | null;
  targetPrice?: number | null;
  lots: number;
  conviction?: string;
  lessons?: string;
  strategyNotes?: string;
  entryDate?: Date | null;
  exitDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TradeJournalEntrySchema = new Schema<ITradeJournalEntry>(
  {
    userId: { type: String, required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    setupName: { type: String, required: true, trim: true },
    side: { type: String, enum: ["buy", "sell"], default: "buy" },
    status: { type: String, enum: ["planned", "open", "closed", "cancelled"], default: "planned" },
    entryPrice: { type: Number, required: true, min: 0 },
    exitPrice: { type: Number, default: null },
    stopLoss: { type: Number, default: null },
    targetPrice: { type: Number, default: null },
    lots: { type: Number, required: true, min: 1 },
    conviction: { type: String, default: "" },
    lessons: { type: String, default: "" },
    strategyNotes: { type: String, default: "" },
    entryDate: { type: Date, default: null },
    exitDate: { type: Date, default: null },
  },
  { timestamps: true }
);

const TradeJournalEntry =
  models.TradeJournalEntry || model<ITradeJournalEntry>("TradeJournalEntry", TradeJournalEntrySchema);

export default TradeJournalEntry;