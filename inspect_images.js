const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    const images = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            width: img.width,
            height: img.height,
            class: img.className,
            rectWidth: img.getBoundingClientRect().width,
            rectHeight: img.getBoundingClientRect().height
        }));
    });
    console.log(JSON.stringify(images.filter(i => i.src && i.src.includes('jpg')), null, 2));
    await browser.close();
})();
