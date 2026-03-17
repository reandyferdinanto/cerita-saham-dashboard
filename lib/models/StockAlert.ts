import { Document, Schema, model, models } from "mongoose";

export type AlertCondition = "above_price" | "below_price" | "above_target" | "below_stop";

export interface IStockAlert extends Document {
  userId: string;
  ticker: string;
  label: string;
  condition: AlertCondition;
  price: number;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockAlertSchema = new Schema<IStockAlert>(
  {
    userId: { type: String, required: true, index: true },
    ticker: { type: String, required: true, uppercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    condition: {
      type: String,
      enum: ["above_price", "below_price", "above_target", "below_stop"],
      default: "above_price",
    },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const StockAlert = models.StockAlert || model<IStockAlert>("StockAlert", StockAlertSchema);

export default StockAlert;