import { Document, Schema, model, models } from "mongoose";

export interface IPortfolioHolding extends Document {
  userId: string;
  ticker: string;
  name: string;
  lots: number;
  averageBuyPrice: number;
  thesis?: string;
  sector?: string;
  targetPrice?: number | null;
  stopLoss?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioHoldingSchema = new Schema<IPortfolioHolding>(
  {
    userId: { type: String, required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    lots: { type: Number, required: true, min: 1 },
    averageBuyPrice: { type: Number, required: true, min: 0 },
    thesis: { type: String, default: "" },
    sector: { type: String, default: "" },
    targetPrice: { type: Number, default: null },
    stopLoss: { type: Number, default: null },
  },
  { timestamps: true }
);

PortfolioHoldingSchema.index({ userId: 1, ticker: 1 }, { unique: true });

const PortfolioHolding =
  models.PortfolioHolding || model<IPortfolioHolding>("PortfolioHolding", PortfolioHoldingSchema);

export default PortfolioHolding;