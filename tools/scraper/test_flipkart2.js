const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.flipkart.com/parle-glucose-biscuit-plain/p/itm62790a5166f7e', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return {
            metaPrice: document.querySelector('meta[property="product:price:amount"]')?.content || document.querySelector('meta[name="twitter:data1"]')?.content,
            allPrices: Array.from(document.querySelectorAll('div, span')).filter(e => e.innerText && e.innerText.match(/^₹[0-9,]+/)).map(e => ({text: e.innerText, class: e.className})).slice(0, 5)
        };
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
