const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    
    // First, try to click the view more details button (case insensitive text match for playwright)
    try {
        await page.click('text=/view more details/i');
        await page.waitForTimeout(1000);
    } catch(e) {}
    
    const details = await page.evaluate(() => {
        return document.body.innerText;
    });
    
    const fs = require('fs');
    fs.writeFileSync('blinkit_text.txt', details);
    console.log("Saved blinkit_text.txt");
    await browser.close();
})();
