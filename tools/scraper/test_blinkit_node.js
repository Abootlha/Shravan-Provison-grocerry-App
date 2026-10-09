const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263');
    await page.waitForTimeout(5000);
    
    const content = await page.content();
    const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
    const matches = content.match(urlRegex) || [];
    console.log("Found rc-upload:", matches.filter(url => url.includes('rc-upload')));
    
    await browser.close();
})();
