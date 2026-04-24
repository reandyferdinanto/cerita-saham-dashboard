const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const SiteSettings = mongoose.model('SiteSettings', new mongoose.Schema({}, {strict: false}), 'sitesettings');
        const s = await SiteSettings.findOne({});
        
        if (s.telegramBotToken) {
            console.log("Checking Webhook for Main Bot...");
            const res = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/getWebhookInfo`);
            const data = await res.json();
            console.log("Main Bot Webhook Info:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
check();
