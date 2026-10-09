const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.flipkart.com/parle-glucose-biscuit-plain/p/itm62790a5166f7e', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div, span'))
            .filter(e => e.innerText && e.innerText.includes('₹') && e.innerText.length < 20)
            .map(e => ({text: e.innerText.replace(/\n/g, ' '), tag: e.tagName}))
            .slice(0, 15);
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
