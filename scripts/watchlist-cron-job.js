const { exec } = require('child_process');

// Konfigurasi
const INTERVAL_MS = 2 * 60 * 1000; // 2 Menit
const API_URL = "http://127.0.0.1:3005/api/cron/watchlist-alert";

function triggerScanner() {
    const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    console.log(`[${now}] Triggering Watchlist Scanner...`);

    // Kita panggil via curl internal agar cepat
    exec(`curl -s "${API_URL}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR] ${error.message}`);
            return;
        }
        try {
            const res = JSON.parse(stdout);
            console.log(`[RESULT]`, res.message || `${res.alertedCount} saham terdeteksi.`);
        } catch (e) {
            console.log(`[RAW RESPONSE]`, stdout.substring(0, 100));
        }
    });
}

// Jalankan pertama kali saat start
triggerScanner();

// Set interval
setInterval(triggerScanner, INTERVAL_MS);

console.log(`Watchlist Cron Job Service started. Running every 2 minutes.`);
