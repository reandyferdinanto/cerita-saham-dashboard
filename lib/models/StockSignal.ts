import mongoose, { Schema, Document, model, models } from "mongoose";

export interface StockSignal {
  id: string;
  ticker: string;
  sector: string;
  signalSource: string;
  entryDate: Date;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice?: number;
  status: 'pending' | 'success' | 'failed' | 'archived';
  daysHeld: number;
  metadata: {
    preMarkupScore?: number;
    volumeSpike?: boolean;
    initialPrice?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface StockSignalDocument extends Document, StockSignal {}

const stockSignalSchema = new Schema<StockSignalDocument>({
  ticker: { type: String, required: true },
  sector: { type: String, required: true },
  signalSource: { type: String, required: true },
  entryDate: { type: Date, required: true },
  entryPrice: { type: Number, required: true },
  targetPrice: { type: Number, required: true },
  stopLossPrice: Number,
  status: { type: String, enum: ['pending', 'success', 'failed', 'archived'], default: 'pending' },
  daysHeld: { type: Number, default: 0 },
  metadata: {
    preMarkupScore: Number,
    volumeSpike: Boolean,
    initialPrice: Number,
  },
}, { timestamps: true });

export const StockSignalModel = models.StockSignal || model<StockSignalDocument>("StockSignal", stockSignalSchema);
