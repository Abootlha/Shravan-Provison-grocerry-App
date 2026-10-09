const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src);
        return imgs.filter(src => src && src.includes('cdn.grofers.com'));
    });
    console.log("Images found:", images.length);
    console.log(images);
    
    await browser.close();
})();
