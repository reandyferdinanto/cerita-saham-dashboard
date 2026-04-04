import { Document, Schema, model, models } from "mongoose";

export interface IBrokerSummaryRow extends Document {
  tradeDate: Date;
  brokerCode: string;
  brokerName?: string;
  symbol?: string | null;
  buyFreq?: number | null;
  buyVolume?: number | null;
  buyValue?: number | null;
  sellFreq?: number | null;
  sellVolume?: number | null;
  sellValue?: number | null;
  netVolume?: number | null;
  netValue?: number | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrokerSummaryRowSchema = new Schema<IBrokerSummaryRow>(
  {
    tradeDate: { type: Date, required: true, index: true },
    brokerCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    brokerName: { type: String, default: null },
    symbol: { type: String, default: null, uppercase: true, trim: true, index: true },
    buyFreq: { type: Number, default: null },
    buyVolume: { type: Number, default: null },
    buyValue: { type: Number, default: null },
    sellFreq: { type: Number, default: null },
    sellVolume: { type: Number, default: null },
    sellValue: { type: Number, default: null },
    netVolume: { type: Number, default: null },
    netValue: { type: Number, default: null, index: true },
    source: { type: String, required: true, default: "manual_csv" },
  },
  { timestamps: true }
);

BrokerSummaryRowSchema.index({ tradeDate: 1, brokerCode: 1, symbol: 1 }, { unique: true });

const BrokerSummaryRow =
  models.BrokerSummaryRow || model<IBrokerSummaryRow>("BrokerSummaryRow", BrokerSummaryRowSchema);

export default BrokerSummaryRow;
