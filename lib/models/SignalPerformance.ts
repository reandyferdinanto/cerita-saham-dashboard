import mongoose, { Schema, Document, model, models } from "mongoose";

export interface SignalPerformance {
  ticker: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  durationDays: number;
  isSuccess: boolean;
  gainPct: number;
  signalSource: string;
}

interface SignalPerformanceDocument extends Document, SignalPerformance {}

const signalPerformanceSchema = new Schema<SignalPerformanceDocument>({
  ticker: { type: String, required: true },
  entryDate: { type: Date, required: true },
  exitDate: { type: Date, required: true },
  entryPrice: { type: Number, required: true },
  exitPrice: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  isSuccess: { type: Boolean, required: true },
  gainPct: { type: Number, required: true },
  signalSource: { type: String, required: true },
}, { timestamps: true });

export const SignalPerformanceModel = models.SignalPerformance || model<SignalPerformanceDocument>("SignalPerformance", signalPerformanceSchema);
