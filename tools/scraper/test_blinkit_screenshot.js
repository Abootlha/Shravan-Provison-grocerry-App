const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tools/scraper/blinkit.png' });
    const content = await page.content();
    require('fs').writeFileSync('tools/scraper/blinkit_dump.html', content);
    await browser.close();
})();
