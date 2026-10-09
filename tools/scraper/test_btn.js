const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    
    try {
        const viewMoreBtn = page.locator('text="View more details"');
        if (await viewMoreBtn.count() > 0) {
            await viewMoreBtn.first().click();
            await page.waitForTimeout(1000);
            console.log("Clicked 'View more details'");
        }
    } catch (e) {
        console.log("Error clicking:", e);
    }

    const html = await page.evaluate(() => {
        let details = '';
        const possibleHeaders = Array.from(document.querySelectorAll('*'));
        const pdHeader = possibleHeaders.find(el => el.textContent && el.textContent.trim().toLowerCase() === 'product details' && el.children.length === 0);
        if (pdHeader) {
            let container = pdHeader.parentElement;
            while(container && container.innerText.length < 500 && container.tagName !== 'BODY') {
                container = container.parentElement;
            }
            details = container ? container.innerText : pdHeader.parentElement.innerText;
        }
        return details;
    });
    console.log("Details length:", html.length);
    console.log("Details Preview:\n" + html.substring(0, 500));
    await browser.close();
})();
