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
  telegramAdminThreadId?: string;
  mlScreenerBotToken?: string;
  mlScreenerChatId?: string;
  // Watchlist Alert Configuration
  watchlistAlertEnabled?: boolean;
  watchlistAlertBotToken?: string;
  watchlistAlertChatId?: string;
  watchlistAlertThreadId?: string;
  watchlistAlertMinEmaOffset?: number; 
  watchlistAlertMaxEmaOffset?: number; 
  watchlistAlertOpenOffset?: number;   
  // New Granular Settings
  watchlistAlertEma20Enabled: boolean;
  watchlistAlertEma20Min: number;
  watchlistAlertEma20Max: number;
  watchlistAlertEma50Enabled: boolean;
  watchlistAlertEma50Min: number;
  watchlistAlertEma50Max: number;
  watchlistAlertOpenGapEnabled: boolean;
  watchlistAlertOpenGapMin: number;
  watchlistAlertUniverse: "watchlist" | "all";
  watchlistAlertMinGain: number; // Minimal kenaikan untuk universe "all"
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    membershipPrices: {
      "3months": { type: Number, default: 0 },
      "6months": { type: Number, default: 0 },
      "1year": { type: Number, default: 0 },
    },
    paymentMethods: [
      {
        name: String,
        type: { type: String, enum: ["bank", "emoney"] },
        accountNumber: String,
        accountName: String,
        logoUrl: String,
      },
    ],
    enabledInvestorTools: [{ type: String }],
    telegramBotToken: { type: String, default: "" },
    telegramWebhookUrl: { type: String, default: "" },
    telegramAdminChatId: { type: String, default: "" },
    telegramAdminThreadId: { type: String, default: "" },
    mlScreenerBotToken: { type: String, default: "" },
    mlScreenerChatId: { type: String, default: "" },
    // Watchlist Alert Configuration
    watchlistAlertEnabled: { type: Boolean, default: false },
    watchlistAlertBotToken: { type: String, default: "" },
    watchlistAlertChatId: { type: String, default: "" },
    watchlistAlertThreadId: { type: String, default: "" },
    watchlistAlertMinEmaOffset: { type: Number, default: 1 },
    watchlistAlertMaxEmaOffset: { type: Number, default: 2 },
    watchlistAlertOpenOffset: { type: Number, default: 2 },
    // Granular Settings Schema
    watchlistAlertEma20Enabled: { type: Boolean, default: true },
    watchlistAlertEma20Min: { type: Number, default: 1 },
    watchlistAlertEma20Max: { type: Number, default: 2 },
    watchlistAlertEma50Enabled: { type: Boolean, default: false },
    watchlistAlertEma50Min: { type: Number, default: 1 },
    watchlistAlertEma50Max: { type: Number, default: 2 },
    watchlistAlertOpenGapEnabled: { type: Boolean, default: true },
    watchlistAlertOpenGapMin: { type: Number, default: 2 },
    watchlistAlertUniverse: { type: String, enum: ["watchlist", "all"], default: "watchlist" },
    watchlistAlertMinGain: { type: Number, default: 5 },
  },
  { timestamps: true }
);

const SiteSettings =
  models.SiteSettings || model<ISiteSettings>("SiteSettings", SiteSettingsSchema);
export default SiteSettings;
