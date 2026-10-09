const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            width: img.getBoundingClientRect().width,
            height: img.getBoundingClientRect().height
        })).filter(img => img.src && img.src.includes('http'));
    });
    console.log(JSON.stringify(images, null, 2));
    await browser.close();
})();
