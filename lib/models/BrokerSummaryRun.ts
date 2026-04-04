import { Document, Schema, model, models } from "mongoose";

export interface IBrokerSummaryRun extends Document {
  source: string;
  mode: "manual" | "remote" | "cron";
  targetDate: Date;
  status: "running" | "success" | "failed";
  message?: string | null;
  rowCount: number;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BrokerSummaryRunSchema = new Schema<IBrokerSummaryRun>(
  {
    source: { type: String, required: true },
    mode: { type: String, enum: ["manual", "remote", "cron"], required: true },
    targetDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["running", "success", "failed"], required: true, index: true },
    message: { type: String, default: null },
    rowCount: { type: Number, default: 0 },
    startedAt: { type: Date, default: () => new Date() },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BrokerSummaryRunSchema.index({ targetDate: 1, status: 1 });

const BrokerSummaryRun =
  models.BrokerSummaryRun || model<IBrokerSummaryRun>("BrokerSummaryRun", BrokerSummaryRunSchema);

export default BrokerSummaryRun;
