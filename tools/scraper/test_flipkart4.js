const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.flipkart.com/parle-glucose-biscuit-plain/p/itm62790a5166f7e', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return document.body.innerText.substring(0, 1000);
    });
    console.log(data);
    await browser.close();
})();
