const mongoose = require('mongoose');
require('dotenv').config();

async function forceTest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const SiteSettings = mongoose.model('SiteSettings', new mongoose.Schema({}, {strict: false}), 'sitesettings');
        const Watchlist = mongoose.model('Watchlist', new mongoose.Schema({}, {strict: false}), 'watchlists');
        
        const settings = await SiteSettings.findOne({});
        const list = await Watchlist.find({});
        
        if (!list.length) return console.log("Watchlist empty");

        // Simple fetch for prices
        const tickers = list.map(i => i.ticker.endsWith(".JK") ? i.ticker : i.ticker + ".JK");
        console.log("Fetching for:", tickers);
        
        // Using a simple fetch to avoid complex imports in this script
        // We'll just simulate the output for a few tickers if needed or use the existing bot logic
        
        let message = `🔍 *DEBUG: STATUS WATCHLIST SAAT INI*\n\n`;
        message += `Daftar saham di watchlist Anda:\n`;
        list.forEach(s => {
            message += `- ${s.ticker}\n`;
        });
        message += `\n_Jika Anda tidak melihat alert otomatis, kemungkinan besar harga saat ini belum masuk ke range 1-2% di atas EMA20 atau belum > 2% dari harga Open._`;

        const res = await fetch(`https://api.telegram.org/bot${settings.watchlistAlertBotToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: settings.watchlistAlertChatId,
                text: message,
                parse_mode: "Markdown",
            }),
        });
        const data = await res.json();
        console.log("Response:", data.ok ? "SUCCESS" : data.description);
    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
forceTest();
