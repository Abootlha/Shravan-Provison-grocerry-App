const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src);
        return imgs.filter(url => url.includes('rc-upload'));
    });
    console.log(data);
    await browser.close();
})();
