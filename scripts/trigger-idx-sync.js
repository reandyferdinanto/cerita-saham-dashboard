const { connectDB } = require("./lib/db");
const { syncIndonesiaStockProfilesFromBEI } = require("./lib/indonesiaStockMaster");

async function run() {
  try {
    const result = await syncIndonesiaStockProfilesFromBEI();
    console.log("Result:", result);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
