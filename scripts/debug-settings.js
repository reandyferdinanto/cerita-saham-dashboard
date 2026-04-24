const mongoose = require('mongoose');
require('dotenv').config();

const SiteSettingsSchema = new mongoose.Schema({
    telegramBotToken: String,
    telegramWebhookUrl: String,
    watchlistAlertBotToken: String,
    watchlistAlertChatId: String
}, { strict: false });

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ceritasaham');
        const SiteSettings = mongoose.models.SiteSettings || mongoose.model('SiteSettings', SiteSettingsSchema, 'sitesettings');
        const s = await SiteSettings.findOne({});
        console.log(JSON.stringify({
            mainBot: s?.telegramBotToken ? "SET" : "EMPTY",
            watchlistBot: s?.watchlistAlertBotToken ? "SET" : "EMPTY",
            watchlistChatId: s?.watchlistAlertChatId,
            webhookUrl: s?.telegramWebhookUrl
        }, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
check();
