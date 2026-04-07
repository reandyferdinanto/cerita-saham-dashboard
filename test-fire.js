const { analyzeSmartMoney } = require("./lib/smartMoneyEngine");

async function run() {
  try {
    const r = await analyzeSmartMoney("FIRE");
    console.log("SUCCESS:", r.ticker);
    console.log("PreMarkup:", r.preMarkupScore);
    console.log("Chart Bars:", r.chartData ? r.chartData.length : 0);
  } catch (e) {
    console.log("FAILED:", e.message);
  }
}
run();
