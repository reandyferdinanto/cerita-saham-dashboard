import { analyzeSmartMoney } from "./lib/smartMoneyEngine";

async function run() {
  try {
    const r = await analyzeSmartMoney("FIRE");
    console.log(JSON.stringify(r.metrics, null, 2));
  } catch (e) {
    console.log("FAILED:", e.message);
  }
}
run();
