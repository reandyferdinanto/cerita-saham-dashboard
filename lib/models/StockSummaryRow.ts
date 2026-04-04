import { Document, Schema, model, models } from "mongoose";

export interface IStockSummaryRow extends Document {
  tradeDate: Date;
  stockCode: string;
  companyName?: string | null;
  remarks?: string | null;
  previous?: number | null;
  openPrice?: number | null;
  firstTrade?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  change?: number | null;
  volume?: number | null;
  value?: number | null;
  frequency?: number | null;
  indexIndividual?: number | null;
  offer?: number | null;
  offerVolume?: number | null;
  bid?: number | null;
  bidVolume?: number | null;
  listedShares?: number | null;
  tradeableShares?: number | null;
  weightForIndex?: number | null;
  foreignSell?: number | null;
  foreignBuy?: number | null;
  nonRegularVolume?: number | null;
  nonRegularValue?: number | null;
  nonRegularFrequency?: number | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockSummaryRowSchema = new Schema<IStockSummaryRow>(
  {
    tradeDate: { type: Date, required: true, index: true },
    stockCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    companyName: { type: String, default: null },
    remarks: { type: String, default: null },
    previous: { type: Number, default: null },
    openPrice: { type: Number, default: null },
    firstTrade: { type: Number, default: null },
    high: { type: Number, default: null },
    low: { type: Number, default: null },
    close: { type: Number, default: null },
    change: { type: Number, default: null },
    volume: { type: Number, default: null },
    value: { type: Number, default: null },
    frequency: { type: Number, default: null },
    indexIndividual: { type: Number, default: null },
    offer: { type: Number, default: null },
    offerVolume: { type: Number, default: null },
    bid: { type: Number, default: null },
    bidVolume: { type: Number, default: null },
    listedShares: { type: Number, default: null },
    tradeableShares: { type: Number, default: null },
    weightForIndex: { type: Number, default: null },
    foreignSell: { type: Number, default: null },
    foreignBuy: { type: Number, default: null },
    nonRegularVolume: { type: Number, default: null },
    nonRegularValue: { type: Number, default: null },
    nonRegularFrequency: { type: Number, default: null },
    source: { type: String, required: true, default: "manual_stock_summary" },
  },
  { timestamps: true }
);

StockSummaryRowSchema.index({ tradeDate: 1, stockCode: 1 }, { unique: true });

const StockSummaryRow =
  models.StockSummaryRow || model<IStockSummaryRow>("StockSummaryRow", StockSummaryRowSchema);

export default StockSummaryRow;
