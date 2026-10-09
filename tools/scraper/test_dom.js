const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    
    try {
        await page.click('text=/view more details/i');
        await page.waitForTimeout(1000);
    } catch(e) {}
    
    const details = await page.evaluate(() => {
        const pd = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.trim().toLowerCase() === 'product details' && el.children.length === 0);
        if (pd) {
            let container = pd.parentElement;
            while (container && container.innerText.length < 50) container = container.parentElement;
            return container ? container.outerHTML : "No parent";
        }
        return "Not found";
    });
    console.log(details);
    await browser.close();
})();
