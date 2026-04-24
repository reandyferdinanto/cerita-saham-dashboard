const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const SiteSettings = mongoose.model('SiteSettings', new mongoose.Schema({}, {strict: false}), 'sitesettings');
        const s = await SiteSettings.findOne({});
        
        if (s.watchlistAlertBotToken && s.watchlistAlertChatId) {
            console.log(`Sending TEST message to ${s.watchlistAlertChatId}...`);
            const res = await fetch(`https://api.telegram.org/bot${s.watchlistAlertBotToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: s.watchlistAlertChatId,
                    text: "🚀 *TEST KONEKSI BERHASIL*\nServer cerita-saham-dashboard berhasil terhubung ke channel ini.",
                    parse_mode: "Markdown",
                }),
            });
            const data = await res.json();
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("Watchlist Bot Token or Chat ID not found in DB.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
test();
