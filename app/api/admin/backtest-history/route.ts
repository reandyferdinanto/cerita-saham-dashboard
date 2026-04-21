import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SignalPerformanceModel } from "@/lib/models/SignalPerformance";
import { calculateSharpeRatio, calculateMaxDrawdown, calculateEquityCurve } from "@/lib/riskAnalytics";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const history = await SignalPerformanceModel.find().sort({ exitDate: 1 }); // Sort ascending for equity curve
    
    const returns = history.map(h => h.gainPct);
    const totalTrades = history.length;
    const wins = history.filter(h => h.isSuccess).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const avgProfit = totalTrades > 0 ? returns.reduce((a, b) => a + b, 0) / totalTrades : 0;
    
    const sharpe = calculateSharpeRatio(returns);
    const maxDrawdown = calculateMaxDrawdown(returns);
    const equityCurve = calculateEquityCurve(returns);

    return NextResponse.json({
      history: [...history].reverse().slice(0, 50), // Return newest first for table
      stats: {
        totalTrades,
        winRate,
        avgProfit,
        sharpe,
        maxDrawdown,
        equityCurve
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memuat riwayat performa" }, { status: 500 });
  }
}
