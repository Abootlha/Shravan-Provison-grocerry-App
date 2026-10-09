const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);

    const htmlSource = await page.evaluate(() => document.documentElement.innerHTML);
    require('fs').writeFileSync('tools/scraper/eval_dump.html', htmlSource);
    await browser.close();
})();
