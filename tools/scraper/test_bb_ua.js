const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.bigbasket.com/pd/40289841/parle-g-oats-berries-cookies-9375-g/', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return { title: document.title, body: document.body.innerText.substring(0, 1000) };
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
