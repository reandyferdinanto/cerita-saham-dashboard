import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import { queryPostgres } from "@/lib/postgres";
import PortfolioHolding from "@/lib/models/PortfolioHolding";
import TradeJournalEntry from "@/lib/models/TradeJournalEntry";
import StockAlert from "@/lib/models/StockAlert";
import CorporateAction from "@/lib/models/CorporateAction";
import { runWithDatabasePreference } from "@/lib/data/provider";
import {
  asDate,
  normalizeBoolean,
  type CorporateActionInput,
  type PlainCorporateAction,
  type PlainPortfolioHolding,
  type PlainStockAlert,
  type PlainTradeJournalEntry,
  type PortfolioInput,
  type StockAlertInput,
  type TradeJournalInput,
} from "@/lib/data/shared";

function toPlainPortfolioHolding(doc: Record<string, unknown>): PlainPortfolioHolding {
  return {
    _id: String(doc._id ?? doc.id),
    userId: String(doc.userId),
    ticker: String(doc.ticker),
    name: String(doc.name),
    lots: Number(doc.lots),
    averageBuyPrice: Number(doc.averageBuyPrice),
    thesis: String(doc.thesis ?? ""),
    sector: String(doc.sector ?? ""),
    targetPrice: doc.targetPrice == null ? null : Number(doc.targetPrice),
    stopLoss: doc.stopLoss == null ? null : Number(doc.stopLoss),
    createdAt: asDate(doc.createdAt as string | Date) ?? new Date(),
    updatedAt: asDate(doc.updatedAt as string | Date) ?? new Date(),
  };
}

function toPlainTradeJournalEntry(doc: Record<string, unknown>): PlainTradeJournalEntry {
  return {
    _id: String(doc._id ?? doc.id),
    userId: String(doc.userId),
    ticker: String(doc.ticker),
    setupName: String(doc.setupName),
    side: doc.side as PlainTradeJournalEntry["side"],
    status: doc.status as PlainTradeJournalEntry["status"],
    entryPrice: Number(doc.entryPrice),
    exitPrice: doc.exitPrice == null ? null : Number(doc.exitPrice),
    stopLoss: doc.stopLoss == null ? null : Number(doc.stopLoss),
    targetPrice: doc.targetPrice == null ? null : Number(doc.targetPrice),
    lots: Number(doc.lots),
    conviction: String(doc.conviction ?? ""),
    lessons: String(doc.lessons ?? ""),
    strategyNotes: String(doc.strategyNotes ?? ""),
    entryDate: asDate(doc.entryDate as string | Date),
    exitDate: asDate(doc.exitDate as string | Date),
    createdAt: asDate(doc.createdAt as string | Date) ?? new Date(),
    updatedAt: asDate(doc.updatedAt as string | Date) ?? new Date(),
  };
}

function toPlainStockAlert(doc: Record<string, unknown>): PlainStockAlert {
  return {
    _id: String(doc._id ?? doc.id),
    userId: String(doc.userId),
    ticker: String(doc.ticker),
    label: String(doc.label),
    condition: doc.condition as PlainStockAlert["condition"],
    price: Number(doc.price),
    isActive: normalizeBoolean(doc.isActive as boolean | null | undefined, true),
    notes: String(doc.notes ?? ""),
    createdAt: asDate(doc.createdAt as string | Date) ?? new Date(),
    updatedAt: asDate(doc.updatedAt as string | Date) ?? new Date(),
  };
}

function toPlainCorporateAction(doc: Record<string, unknown>): PlainCorporateAction {
  return {
    _id: String(doc._id ?? doc.id),
    userId: String(doc.userId),
    ticker: String(doc.ticker),
    title: String(doc.title),
    actionType: doc.actionType as PlainCorporateAction["actionType"],
    actionDate: asDate(doc.actionDate as string | Date) ?? new Date(),
    status: doc.status as PlainCorporateAction["status"],
    notes: String(doc.notes ?? ""),
    createdAt: asDate(doc.createdAt as string | Date) ?? new Date(),
    updatedAt: asDate(doc.updatedAt as string | Date) ?? new Date(),
  };
}

export async function listPortfolioHoldings(userId: string) {
  return runWithDatabasePreference(
    "listPortfolioHoldings",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `select id, user_id as "userId", ticker, name, lots, average_buy_price as "averageBuyPrice",
                thesis, sector, target_price as "targetPrice", stop_loss as "stopLoss",
                created_at as "createdAt", updated_at as "updatedAt"
         from portfolio_holdings where user_id = $1 order by updated_at desc`,
        [userId]
      );
      return result.rows.map(toPlainPortfolioHolding);
    },
    async () => {
      await connectDB();
      const holdings = await PortfolioHolding.find({ userId }).sort({ updatedAt: -1 }).lean();
      return holdings.map((holding) => toPlainPortfolioHolding(holding as unknown as Record<string, unknown>));
    }
  );
}

export async function createPortfolioHolding(input: PortfolioInput) {
  return runWithDatabasePreference(
    "createPortfolioHolding",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `insert into portfolio_holdings (
          id, user_id, ticker, name, lots, average_buy_price, thesis, sector, target_price, stop_loss
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        returning id, user_id as "userId", ticker, name, lots, average_buy_price as "averageBuyPrice",
                  thesis, sector, target_price as "targetPrice", stop_loss as "stopLoss",
                  created_at as "createdAt", updated_at as "updatedAt"`,
        [randomUUID(), input.userId, input.ticker, input.name, input.lots, input.averageBuyPrice, input.thesis, input.sector, input.targetPrice, input.stopLoss]
      );
      return toPlainPortfolioHolding(result.rows[0]);
    },
    async () => {
      await connectDB();
      const created = await PortfolioHolding.create(input);
      return toPlainPortfolioHolding(created.toObject() as unknown as Record<string, unknown>);
    }
  );
}

export async function updatePortfolioHolding(id: string, userId: string, input: PortfolioInput) {
  return runWithDatabasePreference(
    "updatePortfolioHolding",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `update portfolio_holdings
         set ticker = $3, name = $4, lots = $5, average_buy_price = $6, thesis = $7, sector = $8,
             target_price = $9, stop_loss = $10, updated_at = now()
         where id = $1 and user_id = $2
         returning id, user_id as "userId", ticker, name, lots, average_buy_price as "averageBuyPrice",
                   thesis, sector, target_price as "targetPrice", stop_loss as "stopLoss",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [id, userId, input.ticker, input.name, input.lots, input.averageBuyPrice, input.thesis, input.sector, input.targetPrice, input.stopLoss]
      );
      return result.rows[0] ? toPlainPortfolioHolding(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const updated = await PortfolioHolding.findOneAndUpdate({ _id: id, userId }, input, { new: true }).lean();
      return updated ? toPlainPortfolioHolding(updated as unknown as Record<string, unknown>) : null;
    }
  );
}

export async function deletePortfolioHolding(id: string, userId: string) {
  return runWithDatabasePreference(
    "deletePortfolioHolding",
    async () => {
      await queryPostgres(`delete from portfolio_holdings where id = $1 and user_id = $2`, [id, userId]);
    },
    async () => {
      await connectDB();
      await PortfolioHolding.deleteOne({ _id: id, userId });
    }
  );
}

export async function listTradeJournalEntries(userId: string) {
  return runWithDatabasePreference(
    "listTradeJournalEntries",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `select id, user_id as "userId", ticker, setup_name as "setupName", side, status,
                entry_price as "entryPrice", exit_price as "exitPrice", stop_loss as "stopLoss",
                target_price as "targetPrice", lots, conviction, lessons, strategy_notes as "strategyNotes",
                entry_date as "entryDate", exit_date as "exitDate", created_at as "createdAt", updated_at as "updatedAt"
         from trade_journal_entries where user_id = $1 order by updated_at desc`,
        [userId]
      );
      return result.rows.map(toPlainTradeJournalEntry);
    },
    async () => {
      await connectDB();
      const entries = await TradeJournalEntry.find({ userId }).sort({ updatedAt: -1 }).lean();
      return entries.map((entry) => toPlainTradeJournalEntry(entry as unknown as Record<string, unknown>));
    }
  );
}

export async function createTradeJournalEntry(input: TradeJournalInput) {
  return runWithDatabasePreference(
    "createTradeJournalEntry",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `insert into trade_journal_entries (
          id, user_id, ticker, setup_name, side, status, entry_price, exit_price, stop_loss, target_price,
          lots, conviction, lessons, strategy_notes, entry_date, exit_date
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        returning id, user_id as "userId", ticker, setup_name as "setupName", side, status,
                  entry_price as "entryPrice", exit_price as "exitPrice", stop_loss as "stopLoss",
                  target_price as "targetPrice", lots, conviction, lessons, strategy_notes as "strategyNotes",
                  entry_date as "entryDate", exit_date as "exitDate", created_at as "createdAt", updated_at as "updatedAt"`,
        [randomUUID(), input.userId, input.ticker, input.setupName, input.side, input.status, input.entryPrice, input.exitPrice, input.stopLoss, input.targetPrice, input.lots, input.conviction, input.lessons, input.strategyNotes, input.entryDate, input.exitDate]
      );
      return toPlainTradeJournalEntry(result.rows[0]);
    },
    async () => {
      await connectDB();
      const created = await TradeJournalEntry.create(input);
      return toPlainTradeJournalEntry(created.toObject() as unknown as Record<string, unknown>);
    }
  );
}

export async function updateTradeJournalEntry(id: string, userId: string, input: TradeJournalInput) {
  return runWithDatabasePreference(
    "updateTradeJournalEntry",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `update trade_journal_entries
         set ticker = $3, setup_name = $4, side = $5, status = $6, entry_price = $7, exit_price = $8,
             stop_loss = $9, target_price = $10, lots = $11, conviction = $12, lessons = $13,
             strategy_notes = $14, entry_date = $15, exit_date = $16, updated_at = now()
         where id = $1 and user_id = $2
         returning id, user_id as "userId", ticker, setup_name as "setupName", side, status,
                   entry_price as "entryPrice", exit_price as "exitPrice", stop_loss as "stopLoss",
                   target_price as "targetPrice", lots, conviction, lessons, strategy_notes as "strategyNotes",
                   entry_date as "entryDate", exit_date as "exitDate", created_at as "createdAt", updated_at as "updatedAt"`,
        [id, userId, input.ticker, input.setupName, input.side, input.status, input.entryPrice, input.exitPrice, input.stopLoss, input.targetPrice, input.lots, input.conviction, input.lessons, input.strategyNotes, input.entryDate, input.exitDate]
      );
      return result.rows[0] ? toPlainTradeJournalEntry(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const updated = await TradeJournalEntry.findOneAndUpdate({ _id: id, userId }, input, { new: true }).lean();
      return updated ? toPlainTradeJournalEntry(updated as unknown as Record<string, unknown>) : null;
    }
  );
}

export async function deleteTradeJournalEntry(id: string, userId: string) {
  return runWithDatabasePreference(
    "deleteTradeJournalEntry",
    async () => {
      await queryPostgres(`delete from trade_journal_entries where id = $1 and user_id = $2`, [id, userId]);
    },
    async () => {
      await connectDB();
      await TradeJournalEntry.deleteOne({ _id: id, userId });
    }
  );
}

export async function listStockAlerts(userId: string) {
  return runWithDatabasePreference(
    "listStockAlerts",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `select id, user_id as "userId", ticker, label, condition, price, is_active as "isActive",
                notes, created_at as "createdAt", updated_at as "updatedAt"
         from stock_alerts where user_id = $1 order by updated_at desc`,
        [userId]
      );
      return result.rows.map(toPlainStockAlert);
    },
    async () => {
      await connectDB();
      const alerts = await StockAlert.find({ userId }).sort({ updatedAt: -1 }).lean();
      return alerts.map((alert) => toPlainStockAlert(alert as unknown as Record<string, unknown>));
    }
  );
}

export async function createStockAlert(input: StockAlertInput) {
  return runWithDatabasePreference(
    "createStockAlert",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `insert into stock_alerts (id, user_id, ticker, label, condition, price, is_active, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, user_id as "userId", ticker, label, condition, price, is_active as "isActive",
                   notes, created_at as "createdAt", updated_at as "updatedAt"`,
        [randomUUID(), input.userId, input.ticker, input.label, input.condition, input.price, input.isActive, input.notes]
      );
      return toPlainStockAlert(result.rows[0]);
    },
    async () => {
      await connectDB();
      const created = await StockAlert.create(input);
      return toPlainStockAlert(created.toObject() as unknown as Record<string, unknown>);
    }
  );
}

export async function updateStockAlert(id: string, userId: string, input: StockAlertInput) {
  return runWithDatabasePreference(
    "updateStockAlert",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `update stock_alerts
         set ticker = $3, label = $4, condition = $5, price = $6, is_active = $7, notes = $8, updated_at = now()
         where id = $1 and user_id = $2
         returning id, user_id as "userId", ticker, label, condition, price, is_active as "isActive",
                   notes, created_at as "createdAt", updated_at as "updatedAt"`,
        [id, userId, input.ticker, input.label, input.condition, input.price, input.isActive, input.notes]
      );
      return result.rows[0] ? toPlainStockAlert(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const updated = await StockAlert.findOneAndUpdate({ _id: id, userId }, input, { new: true }).lean();
      return updated ? toPlainStockAlert(updated as unknown as Record<string, unknown>) : null;
    }
  );
}

export async function deleteStockAlert(id: string, userId: string) {
  return runWithDatabasePreference(
    "deleteStockAlert",
    async () => {
      await queryPostgres(`delete from stock_alerts where id = $1 and user_id = $2`, [id, userId]);
    },
    async () => {
      await connectDB();
      await StockAlert.deleteOne({ _id: id, userId });
    }
  );
}

export async function listCorporateActions(userId: string) {
  return runWithDatabasePreference(
    "listCorporateActions",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `select id, user_id as "userId", ticker, title, action_type as "actionType", action_date as "actionDate",
                status, notes, created_at as "createdAt", updated_at as "updatedAt"
         from corporate_actions where user_id = $1 order by action_date asc`,
        [userId]
      );
      return result.rows.map(toPlainCorporateAction);
    },
    async () => {
      await connectDB();
      const actions = await CorporateAction.find({ userId }).sort({ actionDate: 1 }).lean();
      return actions.map((action) => toPlainCorporateAction(action as unknown as Record<string, unknown>));
    }
  );
}

export async function createCorporateAction(input: CorporateActionInput) {
  return runWithDatabasePreference(
    "createCorporateAction",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `insert into corporate_actions (id, user_id, ticker, title, action_type, action_date, status, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, user_id as "userId", ticker, title, action_type as "actionType", action_date as "actionDate",
                   status, notes, created_at as "createdAt", updated_at as "updatedAt"`,
        [randomUUID(), input.userId, input.ticker, input.title, input.actionType, input.actionDate, input.status, input.notes]
      );
      return toPlainCorporateAction(result.rows[0]);
    },
    async () => {
      await connectDB();
      const created = await CorporateAction.create(input);
      return toPlainCorporateAction(created.toObject() as unknown as Record<string, unknown>);
    }
  );
}

export async function updateCorporateAction(id: string, userId: string, input: CorporateActionInput) {
  return runWithDatabasePreference(
    "updateCorporateAction",
    async () => {
      const result = await queryPostgres<Record<string, unknown>>(
        `update corporate_actions
         set ticker = $3, title = $4, action_type = $5, action_date = $6, status = $7, notes = $8, updated_at = now()
         where id = $1 and user_id = $2
         returning id, user_id as "userId", ticker, title, action_type as "actionType", action_date as "actionDate",
                   status, notes, created_at as "createdAt", updated_at as "updatedAt"`,
        [id, userId, input.ticker, input.title, input.actionType, input.actionDate, input.status, input.notes]
      );
      return result.rows[0] ? toPlainCorporateAction(result.rows[0]) : null;
    },
    async () => {
      await connectDB();
      const updated = await CorporateAction.findOneAndUpdate({ _id: id, userId }, input, { new: true }).lean();
      return updated ? toPlainCorporateAction(updated as unknown as Record<string, unknown>) : null;
    }
  );
}

export async function deleteCorporateAction(id: string, userId: string) {
  return runWithDatabasePreference(
    "deleteCorporateAction",
    async () => {
      await queryPostgres(`delete from corporate_actions where id = $1 and user_id = $2`, [id, userId]);
    },
    async () => {
      await connectDB();
      await CorporateAction.deleteOne({ _id: id, userId });
    }
  );
}
