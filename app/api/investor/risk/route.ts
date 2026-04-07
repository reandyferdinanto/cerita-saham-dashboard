import { NextRequest, NextResponse } from "next/server";
import { requireUserSession } from "@/lib/userSession";
import { getHistory, searchStocks } from "@/lib/yahooFinance";
import { calcTechnicalSignals } from "@/lib/technicalSignals";

type SupportResistanceLevel = {
  type: "R" | "S";
  price: number;
  strength: number;
};

function normalizeTicker(rawTicker: string) {
  const trimmed = rawTicker.trim().toUpperCase();
  if (!trimmed) return "";
  return trimmed.endsWith(".JK") ? trimmed : `${trimmed}.JK`;
}

function findNearestLevel(levels: SupportResistanceLevel[], type: "R" | "S", entryPrice: number) {
  const filtered = levels.filter((level) =>
    type === "S" ? level.type === "S" && level.price <= entryPrice : level.type === "R" && level.price >= entryPrice
  );

  if (filtered.length === 0) {
    return null;
  }

  return filtered.sort((a, b) => Math.abs(a.price - entryPrice) - Math.abs(b.price - entryPrice))[0];
}

export async function POST(req: NextRequest) {
  const session = await requireUserSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tickerInput = String(body.ticker || "");
  const entryPrice = Number(body.entryPrice || 0);
  const stopLoss = Number(body.stopLoss || 0);
  const targetPrice = Number(body.targetPrice || 0);
  const lots = Number(body.lots || 0);

  if (entryPrice <= 0 || stopLoss <= 0 || targetPrice <= 0 || lots <= 0) {
    return NextResponse.json({ error: "Pastikan Entry, TP, SL, dan Lots sudah diisi dengan benar (>0)." }, { status: 400 });
  }
  if (stopLoss >= entryPrice) {
    return NextResponse.json({ error: "Level Stop Loss harus lebih rendah dari harga Entry." }, { status: 400 });
  }
  if (targetPrice <= entryPrice) {
    return NextResponse.json({ error: "Target Price (TP) harus lebih tinggi dari harga Entry." }, { status: 400 });
  }

  const shares = lots * 100;
  const positionValue = shares * entryPrice;
  const riskPerShare = entryPrice - stopLoss;
  const rewardPerShare = targetPrice - entryPrice;
  const maxLoss = shares * riskPerShare;
  const potentialProfit = shares * rewardPerShare;
  const riskRewardRatio = rewardPerShare / riskPerShare;
  const profitPercent = (rewardPerShare / entryPrice) * 100;
  const lossPercent = (riskPerShare / entryPrice) * 100;

  let ticker = "";
  let supportComparison = null;
  let resistanceComparison = null;
  let supportComparison1h = null;
  let resistanceComparison1h = null;

  if (tickerInput.trim()) {
    const normalizedTicker = normalizeTicker(tickerInput);
    let resolvedTicker = normalizedTicker;

    if (!normalizedTicker.endsWith(".JK")) {
      const searchResults = await searchStocks(tickerInput);
      resolvedTicker = searchResults[0]?.symbol || normalizedTicker;
    }

    ticker = resolvedTicker;

    const [history4h, history1h] = await Promise.all([
      getHistory(
        resolvedTicker,
        new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        undefined,
        "4h"
      ),
      getHistory(
        resolvedTicker,
        new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        undefined,
        "1h"
      ),
    ]);

    const buildComparison = (history: Awaited<ReturnType<typeof getHistory>>, label: "1H" | "4H") => {
      if (history.length < 40) {
        return { support: null, resistance: null };
      }

      const technical = calcTechnicalSignals(history);
      const nearestSupport = findNearestLevel(technical.srLevels, "S", entryPrice);
      const nearestResistance = findNearestLevel(technical.srLevels, "R", entryPrice);

      return {
        support: nearestSupport
          ? {
              price: nearestSupport.price,
              strength: nearestSupport.strength,
              differenceFromSL: stopLoss - nearestSupport.price,
              differencePercentFromSL:
                nearestSupport.price > 0 ? ((stopLoss - nearestSupport.price) / nearestSupport.price) * 100 : 0,
              note:
                stopLoss >= nearestSupport.price
                  ? `SL berada di atas atau dekat support ${label}. Masih ada risiko mudah tersentuh jika support ditembus tipis.`
                  : `SL berada di bawah support ${label} sehingga memberi ruang lebih longgar. Perhatikan jika jaraknya terlalu jauh.`,
            }
          : null,
        resistance: nearestResistance
          ? {
              price: nearestResistance.price,
              strength: nearestResistance.strength,
              differenceFromTP: targetPrice - nearestResistance.price,
              differencePercentFromTP:
                nearestResistance.price > 0 ? ((targetPrice - nearestResistance.price) / nearestResistance.price) * 100 : 0,
              note:
                targetPrice <= nearestResistance.price
                  ? `TP berada di bawah atau dekat resistance ${label}. Lebih realistis untuk profit taking bertahap.`
                  : `TP berada di atas resistance ${label}. Potensi profit lebih besar, tetapi butuh breakout yang valid.`,
            }
          : null,
      };
    };

    const comparisons4h = buildComparison(history4h, "4H");
    const comparisons1h = buildComparison(history1h, "1H");
    supportComparison = comparisons4h.support;
    resistanceComparison = comparisons4h.resistance;
    supportComparison1h = comparisons1h.support;
    resistanceComparison1h = comparisons1h.resistance;
  }

  return NextResponse.json({
    ticker,
    shares,
    lots,
    entryPrice,
    targetPrice,
    stopLoss,
    positionValue,
    riskPerShare,
    rewardPerShare,
    maxLoss,
    potentialProfit,
    riskRewardRatio,
    profitPercent,
    lossPercent,
    supportComparison1h,
    resistanceComparison1h,
    supportComparison,
    resistanceComparison,
  });
}
