const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    const data = await page.evaluate(() => {
        let result = { images: [] };
        
        const ogImage = document.querySelector('meta[property="og:image"]')?.content;
        if (ogImage) {
            result.images.push(ogImage);
            result._ogImageOnly = true;
        }
        
        let imgs = [];
        const prefixes = [];
        for (const imgUrl of result.images) {
            try {
                let filename = imgUrl.split('?')[0].split('/').pop().split('.')[0];
                if (filename.includes('rc-upload')) {
                    filename = filename.replace(/-\d+$/, '');
                }
                if (filename.length > 5) {
                    prefixes.push(filename);
                }
            } catch(e){}
        }

        if (prefixes.length > 0 && !result._ogImageOnly) {
            const htmlSource = document.documentElement.innerHTML;
            const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
            const matches = htmlSource.match(urlRegex) || [];
            imgs = matches.filter(url => prefixes.some(prefix => url.includes(prefix)));
        } else {
            const htmlSource = document.documentElement.innerHTML;
            const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
            const matches = htmlSource.match(urlRegex) || [];
            
            imgs = Array.from(document.querySelectorAll('img'))
                .map(img => img.src)
                .concat(matches)
                .filter(src => {
                    if (!src) return false;
                    if (src.includes('cms-assets/cms/product/')) return true;
                    const isHighResUrl = (src.includes('1000x1000') || src.includes('500x500') || src.includes('w=1080') || src.includes('w=828') || src.includes('w=480') || src.includes('w=540')) && !src.includes('w=128') && !src.includes('w=256');
                    return isHighResUrl;
                });
        }
        
        const normalizeUrl = (url) => {
            if (!url) return url;
            if (url.includes('/_next/image')) {
                try {
                    const parsed = new URL(url, 'https://blinkit.com');
                    const innerUrl = parsed.searchParams.get('url');
                    if (innerUrl) url = innerUrl;
                } catch(e){}
            }
            url = decodeURIComponent(url);
            let clean = url.replace(/w=\d+,?/, '').replace(/h=\d+,?/, '').replace(/q=\d+,?/, '').replace(/fit=[^,]+,?/, '').replace(/metadata=[^,]+,?/, '').replace(/f=[^,]+,?/, '');
            clean = clean.replace(/\/cdn-cgi\/image\/[^\/]+\//, '/');
            return clean.split('?')[0];
        };

        result.images = result.images.map(normalizeUrl);
        imgs = imgs.map(normalizeUrl);
        imgs = imgs.filter(url => !url.includes('blur') && !url.includes('base64'));
        result.images = [...new Set([...result.images, ...imgs])]; 
        
        return result.images;
    });
    
    console.log("Returned images:", data);
    await browser.close();
})();
