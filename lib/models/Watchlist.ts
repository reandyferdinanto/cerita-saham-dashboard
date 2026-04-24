import { Schema, model, models, Document } from "mongoose";
import { WatchlistEntry } from "../types";

export interface IWatchlistEntry extends WatchlistEntry, Document {}

const WatchlistSchema = new Schema<IWatchlistEntry>(
  {
    ticker: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    tp: { type: Number, default: null },
    sl: { type: Number, default: null },
    bandarmology: { type: String, default: "" },
    addedAt: { type: String, required: true },
    lastAlertedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

const Watchlist =
  models.Watchlist || model<IWatchlistEntry>("Watchlist", WatchlistSchema);
export default Watchlist;

