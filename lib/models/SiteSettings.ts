import { Schema, model, models, Document } from "mongoose";

export interface IPaymentMethod {
  name: string;       // e.g. "BCA", "OVO", "GoPay"
  type: "bank" | "emoney";
  accountNumber: string;
  accountName: string;
  logoUrl?: string;
}

export interface ISiteSettings extends Document {
  membershipPrices: {
    "3months": number;
    "6months": number;
    "1year": number;
  };
  paymentMethods: IPaymentMethod[];
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    membershipPrices: {
      "3months": { type: Number, default: 300000 },
      "6months": { type: Number, default: 550000 },
      "1year":   { type: Number, default: 1100000 },
    },
    paymentMethods: [
      {
        name:          { type: String, required: true },
        type:          { type: String, enum: ["bank", "emoney"], default: "bank" },
        accountNumber: { type: String, required: true },
        accountName:   { type: String, required: true },
        logoUrl:       { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const SiteSettings =
  models.SiteSettings || model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
export default SiteSettings;

