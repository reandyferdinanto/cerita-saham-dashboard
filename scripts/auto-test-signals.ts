/**
 * Script untuk memantau status signal:
 * 1. Jika currentPrice >= targetPrice -> Success (Catat durasi, update status)
 * 2. Jika daysHeld > 5 -> Failed/Archived (Update status)
 */

import { connectDB } from "../lib/db";
import { StockSignalModel } from "../lib/models/StockSignal";
import { SignalPerformanceModel } from "../lib/models/SignalPerformance";
import { getQuote } from "../lib/yahooFinance";

async function updateSignalStatuses() {
  await connectDB();
  console.log("Checking signal statuses...");
  
  const pendingSignals = await StockSignalModel.find({ status: 'pending' });
  
  for (const signal of pendingSignals) {
    const currentQuote = await getQuote(signal.ticker);
    const currentPrice = currentQuote ? currentQuote.price : signal.entryPrice;
    const now = new Date();
    const durationDays = Math.floor((now.getTime() - signal.entryDate.getTime()) / (1000 * 3600 * 24));

    if (currentPrice >= signal.targetPrice) {
      // Log Success
      await SignalPerformanceModel.create({
        ticker: signal.ticker,
        entryDate: signal.entryDate,
        exitDate: now,
        entryPrice: signal.entryPrice,
        exitPrice: currentPrice,
        durationDays,
        isSuccess: true,
        gainPct: ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100,
        signalSource: signal.signalSource,
      });

      await StockSignalModel.findByIdAndUpdate(signal.id, { 
        status: 'success', 
        daysHeld: durationDays, 
        updatedAt: now 
      });
      console.log(`Signal for ${signal.ticker} marked as SUCCESS.`);
    } 
    else if (durationDays > 5) {
      // Log Failure (Archived)
      await SignalPerformanceModel.create({
        ticker: signal.ticker,
        entryDate: signal.entryDate,
        exitDate: now,
        entryPrice: signal.entryPrice,
        exitPrice: currentPrice,
        durationDays,
        isSuccess: false,
        gainPct: ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100,
        signalSource: signal.signalSource,
      });

      await StockSignalModel.findByIdAndUpdate(signal.id, { 
        status: 'archived', 
        daysHeld: durationDays, 
        updatedAt: now 
      });
      console.log(`Signal for ${signal.ticker} archived after ${durationDays} days.`);
    }
  }
}

updateSignalStatuses().catch(console.error);
