const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const data = await page.evaluate(() => {
        let imgs = [];
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const json = JSON.parse(script.innerText);
                const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
                for (const item of items) {
                    if (item['@type'] === 'Product') {
                        if (item.image) {
                            if (Array.isArray(item.image)) imgs.push(...item.image);
                            else imgs.push(item.image);
                        }
                    }
                }
            } catch(e){}
        }
        return imgs;
    });
    console.log("JSON-LD Images:", data);

    const domImgs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(i => i.src).filter(src => src.includes('grofers') || src.includes('blinkit'));
    });
    console.log("DOM Images:", domImgs);

    await browser.close();
})();
