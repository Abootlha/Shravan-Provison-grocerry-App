const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    const data = await page.evaluate(() => {
        const htmlSource = document.documentElement.innerHTML;
        const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
        const matches = htmlSource.match(urlRegex) || [];
        return matches.filter(url => url.includes('rc-upload'));
    });
    console.log("Found rc-upload:", data);
    await browser.close();
})();
