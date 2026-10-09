const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('response', async (response) => {
        if (response.url().includes('api') || response.url().includes('json')) {
            console.log("API URL:", response.url());
            try {
                const text = await response.text();
                if (text.includes('rc-upload')) {
                    console.log("Found rc-upload in", response.url());
                }
            } catch(e) {}
        }
    });
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263');
    await page.waitForTimeout(5000);
    await browser.close();
})();
