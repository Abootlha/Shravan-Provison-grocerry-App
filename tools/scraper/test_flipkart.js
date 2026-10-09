const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.flipkart.com/parle-glucose-biscuit-plain/p/itm62790a5166f7e', { waitUntil: 'networkidle' });
    const data = await page.evaluate(() => {
        return {
            title: document.title,
            jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.innerText),
            priceText: document.querySelector('.Nx9bqj.CxhGGd') ? document.querySelector('.Nx9bqj.CxhGGd').innerText : null,
            anyPrice: Array.from(document.querySelectorAll('div, span')).filter(e => e.innerText && e.innerText.match(/^₹[0-9,]+/)).map(e => e.innerText).slice(0, 5)
        };
    });
    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
