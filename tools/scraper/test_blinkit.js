const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    const html = await page.evaluate(() => document.body.innerHTML);
    const fs = require('fs');
    fs.writeFileSync('blinkit_dom.html', html);
    await browser.close();
})();
