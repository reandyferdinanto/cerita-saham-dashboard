import { connectDB } from "../lib/db";
import SiteSettings from "../lib/models/SiteSettings";

async function checkWebhook() {
  try {
    await connectDB();
    const settings = await SiteSettings.findOne({});
    const token = settings?.telegramBotToken;
    if (!token) {
      console.log("No bot token found.");
      process.exit(1);
    }
    
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();
    console.log("Telegram Webhook Info:");
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkWebhook();
