const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-treat-jim-jam-sandwich-crme-biscuits/prid/35382', { waitUntil: 'networkidle' });
    const nextData = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? JSON.parse(el.textContent) : null;
    });
    if (nextData) {
        const fs = require('fs');
        fs.writeFileSync('next_data.json', JSON.stringify(nextData, null, 2));
        console.log("Saved __NEXT_DATA__ to next_data.json");
    } else {
        console.log("__NEXT_DATA__ not found");
    }
    await browser.close();
})();
