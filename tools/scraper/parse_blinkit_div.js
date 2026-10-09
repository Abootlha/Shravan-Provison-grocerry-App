const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    
    // First, try to click the view more details button
    await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const btn = divs.find(d => d.innerText && d.innerText.includes('View more details') && d.children.length === 0);
        if (btn) btn.click();
    });
    
    await page.waitForTimeout(1000);
    
    const details = await page.evaluate(() => {
        const h3s = Array.from(document.querySelectorAll('h2, h3'));
        const pdHeader = h3s.find(h => h.innerText && h.innerText.toLowerCase().includes('product details'));
        if (pdHeader) {
            // Blinkit's product details are usually in a sibling or parent sibling container
            let container = pdHeader.parentElement;
            return container.innerText;
        }
        return "Not found";
    });
    
    console.log("Details:\n", details);
    await browser.close();
})();
