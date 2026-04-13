import { connectDB } from "../lib/db";
import SiteSettings from "../lib/models/SiteSettings";
import IndonesiaStock from "../lib/models/IndonesiaStock";

async function checkSettings() {
  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    if (!settings) {
      console.log("No SiteSettings found in database.");
    } else {
      console.log("SiteSettings found:");
      console.log(`Telegram Bot Token: ${settings.telegramBotToken ? "SET (hidden)" : "NOT SET"}`);
      console.log(`Telegram Webhook URL: ${settings.telegramWebhookUrl || "NOT SET"}`);
      if (settings.telegramBotToken) {
          console.log(`Token starts with: ${settings.telegramBotToken.substring(0, 10)}...`);
      }
    }
    
    const stockCount = await IndonesiaStock.countDocuments({});
    const activeStockCount = await IndonesiaStock.countDocuments({ active: true });
    console.log(`Stocks in DB: ${stockCount} (Active: ${activeStockCount})`);
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkSettings();
