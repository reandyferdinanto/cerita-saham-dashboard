import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

export async function takeChartScreenshot(ticker: string, interval: string = "1d"): Promise<string | null> {
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    try {
        const page = await browser.newPage();
        
        // Atur viewport agar cukup lebar untuk kontainer 1000x1050
        await page.setViewportSize({ width: 1050, height: 1100 });


        // Gunakan port 3005 sesuai dengan yang terlihat di log PM2
        const url = `http://127.0.0.1:3005/stock/${ticker.toUpperCase()}/bot-view?interval=${interval}`;
        console.log(`[Playwright] Navigating to internal URL: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        } catch (err) {
            console.warn("[Playwright] Networkidle failed, trying load state...");
            await page.goto(url, { waitUntil: 'load', timeout: 15000 });
        }

        // Tunggu hingga area chart (#capture-area) benar-benar muncul dan loading spinner hilang
        try {
            await page.waitForSelector('#capture-area', { state: 'visible', timeout: 10000 });
            await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
        } catch (e) {
            console.warn("[Playwright] Wait selectors timed out, proceeding with best effort...");
        }
        
        // Beri jeda extra agar canvas chart selesai dirender sempurna
        await page.waitForTimeout(7000); 

        const filename = `chart-${ticker.toLowerCase()}.png`;
        const filepath = path.join(process.cwd(), 'public', 'screenshots', filename);
        
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // TANGKAP ELEMEN SPESIFIK
        const captureArea = await page.$('#capture-area');
        if (captureArea) {
            await captureArea.screenshot({ path: filepath });
        } else {
            // Fallback jika id tidak ketemu
            await page.screenshot({ path: filepath });
        }
        console.log(`[Playwright] Screenshot saved to ${filepath}`);

        await browser.close();
        // Berikan cache buster agar Telegram tidak mengambil gambar lama
        return `https://ceritasaham-dashboard.my.id/screenshots/${filename}?v=${Date.now()}`;
    } catch (e) {
        console.error("[Playwright ERROR]:", e);
        await browser.close();
        return null;
    }
}
