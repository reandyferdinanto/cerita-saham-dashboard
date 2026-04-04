import { Document, Schema, model, models } from "mongoose";

type SnapshotRow = {
  ticker: string;
  name: string;
  fitScore: number;
  phase: string;
  operatorBias: string;
  actionBias: string;
  tone: "bullish" | "neutral" | "bearish" | "warning";
  conviction: number;
  price: number;
  changePercent: number;
  breakoutDistancePct: number | null;
  volumeRatio5v20: number | null;
  upDownVolumeRatio: number | null;
  priceVsMa20: number | null;
  priceVsMa50: number | null;
  rsi: number | null;
  support: number[];
  resistance: number[];
  obvSlope20: number | null;
  adSlope20: number | null;
  technicalScore: number;
  reasons: string[];
  strategyLabel: string;
  thesis: string;
  accumulationBias: number;
  breakoutReadiness: number;
};

export interface IBandarmologyScreenerSnapshot extends Document {
  snapshotDate: string;
  preset: string;
  priceBucket: string;
  universeSize: number;
  bucketUniverseSize: number;
  analyzedUniverseSize: number;
  rows: SnapshotRow[];
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotRowSchema = new Schema<SnapshotRow>(
  {
    ticker: { type: String, required: true },
    name: { type: String, required: true },
    fitScore: { type: Number, required: true },
    phase: { type: String, required: true },
    operatorBias: { type: String, required: true },
    actionBias: { type: String, required: true },
    tone: { type: String, required: true },
    conviction: { type: Number, required: true },
    price: { type: Number, required: true },
    changePercent: { type: Number, required: true },
    breakoutDistancePct: { type: Number, default: null },
    volumeRatio5v20: { type: Number, default: null },
    upDownVolumeRatio: { type: Number, default: null },
    priceVsMa20: { type: Number, default: null },
    priceVsMa50: { type: Number, default: null },
    rsi: { type: Number, default: null },
    support: { type: [Number], default: [] },
    resistance: { type: [Number], default: [] },
    obvSlope20: { type: Number, default: null },
    adSlope20: { type: Number, default: null },
    technicalScore: { type: Number, required: true },
    reasons: { type: [String], default: [] },
    strategyLabel: { type: String, required: true },
    thesis: { type: String, required: true },
    accumulationBias: { type: Number, required: true },
    breakoutReadiness: { type: Number, required: true },
  },
  { _id: false }
);

const BandarmologyScreenerSnapshotSchema = new Schema<IBandarmologyScreenerSnapshot>(
  {
    snapshotDate: { type: String, required: true, index: true },
    preset: { type: String, required: true, index: true },
    priceBucket: { type: String, required: true, index: true },
    universeSize: { type: Number, required: true, default: 0 },
    bucketUniverseSize: { type: Number, required: true, default: 0 },
    analyzedUniverseSize: { type: Number, required: true, default: 0 },
    rows: { type: [SnapshotRowSchema], default: [] },
  },
  { timestamps: true }
);

BandarmologyScreenerSnapshotSchema.index({ snapshotDate: 1, preset: 1, priceBucket: 1 }, { unique: true });

const BandarmologyScreenerSnapshot =
  models.BandarmologyScreenerSnapshot ||
  model<IBandarmologyScreenerSnapshot>("BandarmologyScreenerSnapshot", BandarmologyScreenerSnapshotSchema);

export default BandarmologyScreenerSnapshot;
