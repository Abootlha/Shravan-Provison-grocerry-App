const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.bigbasket.com/pd/40289841/parle-g-oats-berries-cookies-9375-g/', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return { title: document.title, body: document.body.innerText.substring(0, 1000) };
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
