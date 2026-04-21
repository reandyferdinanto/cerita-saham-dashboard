import { Document, Schema, model, models } from "mongoose";

export interface IIndonesiaStock extends Document {
  symbol: string;
  ticker: string;
  name: string;
  exchange: string;
  source: string;
  sourceUrl: string;
  sourcePage: number;
  sourceRank: number;
  lastPrice: number | null;
  marketCapText: string | null;
  // Profile fields from BEI
  listingDate: Date | null;
  sector: string | null;
  industry: string | null;
  subIndustry: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  active: boolean;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IndonesiaStockSchema = new Schema<IIndonesiaStock>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    ticker: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    exchange: { type: String, default: "IDX" },
    source: { type: String, required: true, default: "stockanalysis" },
    sourceUrl: { type: String, required: true },
    sourcePage: { type: Number, required: true, default: 1 },
    sourceRank: { type: Number, required: true, index: true },
    lastPrice: { type: Number, default: null, index: true },
    marketCapText: { type: String, default: null },
    // Profile fields from BEI
    listingDate: { type: Date, default: null },
    sector: { type: String, default: null, index: true },
    industry: { type: String, default: null, index: true },
    subIndustry: { type: String, default: null },
    website: { type: String, default: null },
    address: { type: String, default: null },
    description: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    lastSyncedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

const IndonesiaStock =
  models.IndonesiaStock || model<IIndonesiaStock>("IndonesiaStock", IndonesiaStockSchema);

export default IndonesiaStock;
