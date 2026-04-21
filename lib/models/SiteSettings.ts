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
  enabledInvestorTools: string[];
  telegramBotToken?: string;
  telegramWebhookUrl?: string;
  telegramAdminChatId?: string;
  mlScreenerBotToken?: string;
  mlScreenerChatId?: string;
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    // ...
    telegramBotToken: { type: String, default: "" },
    telegramWebhookUrl: { type: String, default: "" },
    telegramAdminChatId: { type: String, default: "" },
    mlScreenerBotToken: { type: String, default: "" },
    mlScreenerChatId: { type: String, default: "" },
  },
  { timestamps: true }
);

const SiteSettings =
  models.SiteSettings || model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
export default SiteSettings;

