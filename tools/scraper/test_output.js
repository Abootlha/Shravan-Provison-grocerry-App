const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    try {
        const expandButtons = await page.$$('text=/view more details/i');
        for (const btn of expandButtons) {
            if (await btn.isVisible()) {
                await btn.click();
                await page.waitForTimeout(1000);
                break;
            }
        }
    } catch(e) {}
    
    const details = await page.evaluate(() => {
        const pdHeader = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'product details' && el.children.length === 0);
        if (pdHeader) {
            let container = pdHeader.parentElement;
            while (container && container.innerText.length < 100 && container.tagName !== 'BODY') {
                container = container.parentElement;
            }
            if (container) return container.innerText.trim();
        }
        return "Not found";
    });
    console.log(details);
    await browser.close();
})();
