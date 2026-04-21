import { analyzeSmartMoney } from "../lib/smartMoneyEngine";

async function testIntradaySmartMoney() {
  const ticker = "BBCA"; // Contoh ticker
  const intervals: ("15m" | "4h" | "1d")[] = ["15m", "4h", "1d"];

  console.log(`--- Testing Smart Money Engine for ${ticker} ---`);

  for (const interval of intervals) {
    try {
      console.log(`\nTesting interval: ${interval}`);
      const result = await analyzeSmartMoney(ticker, interval);
      console.log(`Phase: ${result.currentPhaseLabel}`);
      console.log(`Conviction: ${result.conviction}`);
      console.log(`Events found: ${result.events.length}`);
    } catch (error) {
      console.error(`Error testing interval ${interval}:`, error);
    }
  }
}

testIntradaySmartMoney();
