import type { IPaymentMethod } from "@/lib/models/SiteSettings";
import type { MembershipDuration, MembershipStatus } from "@/lib/models/User";
import type { AlertCondition } from "@/lib/models/StockAlert";
import type { CorporateActionStatus, CorporateActionType } from "@/lib/models/CorporateAction";
import type { TradeSide, TradeStatus } from "@/lib/models/TradeJournalEntry";

export type PlainUser = {
  _id: string;
  email: string;
  phoneHash: string;
  role: "user" | "admin" | "superadmin";
  avatarUrl: string | null;
  name: string | null;
  membershipStatus: MembershipStatus;
  membershipDuration: MembershipDuration | null;
  membershipStartDate: Date | null;
  membershipEndDate: Date | null;
  membershipNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlainSiteSettings = {
  _id: string;
  membershipPrices: {
    "3months": number;
    "6months": number;
    "1year": number;
  };
  paymentMethods: IPaymentMethod[];
  enabledInvestorTools: string[];
  updatedAt: Date;
};

export type PlainPortfolioHolding = {
  _id: string;
  userId: string;
  ticker: string;
  name: string;
  lots: number;
  averageBuyPrice: number;
  thesis: string;
  sector: string;
  targetPrice: number | null;
  stopLoss: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlainTradeJournalEntry = {
  _id: string;
  userId: string;
  ticker: string;
  setupName: string;
  side: TradeSide;
  status: TradeStatus;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  targetPrice: number | null;
  lots: number;
  conviction: string;
  lessons: string;
  strategyNotes: string;
  entryDate: Date | null;
  exitDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlainStockAlert = {
  _id: string;
  userId: string;
  ticker: string;
  label: string;
  condition: AlertCondition;
  price: number;
  isActive: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PlainCorporateAction = {
  _id: string;
  userId: string;
  ticker: string;
  title: string;
  actionType: CorporateActionType;
  actionDate: Date;
  status: CorporateActionStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PlainArticle = {
  _id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  isPublic: boolean;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioInput = Omit<PlainPortfolioHolding, "_id" | "createdAt" | "updatedAt">;
export type TradeJournalInput = Omit<PlainTradeJournalEntry, "_id" | "createdAt" | "updatedAt">;
export type StockAlertInput = Omit<PlainStockAlert, "_id" | "createdAt" | "updatedAt">;
export type CorporateActionInput = Omit<PlainCorporateAction, "_id" | "createdAt" | "updatedAt">;
export type ArticleInput = Omit<PlainArticle, "_id" | "createdAt" | "updatedAt" | "authorId"> & {
  authorId?: string | null;
};

export const DEFAULT_INVESTOR_TOOLS = [
  "aiBrief",
  "riskCalculator",
  "rightsIssueCalculator",
  "stockSplitCalculator",
  "investorScreener",
];

export const DEFAULT_SITE_SETTINGS = {
  membershipPrices: {
    "3months": 300000,
    "6months": 550000,
    "1year": 1100000,
  },
  paymentMethods: [
    { name: "BCA", type: "bank", accountNumber: "1234567890", accountName: "anomalisaham" },
    { name: "OVO", type: "emoney", accountNumber: "08123456789", accountName: "anomalisaham" },
  ] satisfies IPaymentMethod[],
  enabledInvestorTools: DEFAULT_INVESTOR_TOOLS,
};

export function asDate(value: string | Date | null | undefined) {
  return value ? new Date(value) : null;
}

export function normalizeBoolean(value: boolean | null | undefined, fallback = false) {
  return value == null ? fallback : Boolean(value);
}
