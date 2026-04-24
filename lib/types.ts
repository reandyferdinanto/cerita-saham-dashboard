export interface WatchlistEntry {
  ticker: string;
  name: string;
  tp: number | null;       // Take Profit target price
  sl: number | null;       // Stop Loss price
  bandarmology: string;    // Bandarmology notes
  addedAt: string;         // ISO date string
  lastAlertedAt?: Date | null;
}

export type UserRole = "user" | "admin" | "superadmin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  name?: string | null;
  createdAt?: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  marketCap?: number;
  delayMinutes?: number | null; // data delay from exchange in minutes
}

export interface OHLCData {
  time: string | number;  // YYYY-MM-DD for daily, unix timestamp (seconds) for intraday
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndexData {
  time: string | number;
  value: number;
}

export interface WatchlistWithQuote extends WatchlistEntry {
  quote?: StockQuote;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  quoteType: string;
}
