const { chromium } = require('playwright');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

const LINKS_FILE = path.join(__dirname, 'links.txt');
const OUTPUT_FILE = path.join(__dirname, 'output.csv');

async function extractProductData(page, url) {
    console.log(`Scraping: ${url}`);
    try {
        if (url.includes('bigbasket.com')) {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
                }
            });
            const html = await res.text();
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
            
            if (match) {
                const data = JSON.parse(match[1]);
                const child = data.props?.pageProps?.productDetails?.children?.[0];
                if (child) {
                    const price = child.pricing?.discount?.mrp || 0;
                    const sellingPrice = child.pricing?.discount?.sp || price;
                    
                    const images = [];
                    if (child.images && Array.isArray(child.images)) {
                        child.images.forEach(imgObj => {
                            if (imgObj.xl) images.push(imgObj.xl);
                            else if (imgObj.l) images.push(imgObj.l);
                        });
                    }

                    let extendedDesc = '';
                    if (child.tabs && Array.isArray(child.tabs)) {
                        child.tabs.forEach(tab => {
                            if (tab.title && tab.content) {
                                let textContent = tab.content.replace(/<style[^>]*>.*?<\/style>/gi, '')
                                                             .replace(/<[^>]+>/g, '')
                                                             .replace(/\r\n/g, '\n')
                                                             .replace(/\n\s*\n/g, '\n')
                                                             .replace(/&amp;/g, '&')
                                                             .trim();
                                extendedDesc += `\n\n${tab.title}\n${textContent}`;
                            }
                        });
                    }

                    let cleanDesc = child.desc || '';
                    const brandName = child.brand?.name || '';
                    if (brandName) {
                        const brandRegex = new RegExp(brandName, 'gi');
                        cleanDesc = cleanDesc.replace(brandRegex, '');
                        extendedDesc = extendedDesc.replace(brandRegex, '');
                    }
                    cleanDesc = cleanDesc.replace(/bigbasket|bb|blinkit|zepto|grofers/gi, '');
                    extendedDesc = extendedDesc.replace(/bigbasket|bb|blinkit|zepto|grofers/gi, '');

                    return {
                        Barcode: '',
                        Name: child.desc ? child.desc.trim().substring(0, 100) : 'Unknown Product',
                        Brand: '',
                        Price: sellingPrice,
                        OriginalPrice: price,
                        Stock: 50,
                        Unit: child.weight || '1pc',
                        Category: '',
                        Subcategory: '',
                        ItemGroup: '',
                        Description: `Product Name: ${cleanDesc}\nBrand: ${brandName}\nWeight: ${child.weight || ''}${extendedDesc}`.trim(),
                        Highlights: '',
                        Images: images.join('|'),
                        ImageURL1: images[0] || '',
                        ImageURL2: images[1] || '',
                        ImageURL3: images[2] || '',
                        ImageURL4: images[3] || '',
                        ImageURL5: images[4] || '',
                        ImageURL6: images[5] || '',
                        ImageURL7: images[6] || '',
                        ImageURL8: images[7] || '',
                        ImageURL9: images[8] || '',
                        ImageURL10: images[9] || '',
                        ImageURL11: images[10] || '',
                        ImageURL12: images[11] || '',
                        ImageURL13: images[12] || '',
                        ImageURL14: images[13] || '',
                        ImageURL15: images[14] || '',
                    };
                }
            }
            throw new Error("Could not parse BigBasket product data via fetch.");
        }

        // Playwright navigation
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Wait for bot challenges (AWS WAF / Cloudflare) and React hydration
        for (let i = 0; i < 15; i++) {
            await page.waitForTimeout(1000);
            const title = await page.title();
            const h1 = await page.$('h1');
            if (title && !title.includes('Just a moment') && (h1 || title.includes('Buy') || title.includes('Online') || title.length > 10)) {
                break;
            }
        }

        // Click "View more details" to expand all sections (for Blinkit etc)
        try {
            const expandButtons = await page.$$('text=/view more details/i');
            for (const btn of expandButtons) {
                if (await btn.isVisible()) {
                    await btn.click();
                    await page.waitForTimeout(1000);
                    break;
                }
            }
        } catch (e) {
            // Ignore click error
        }

        const data = await page.evaluate(() => {
            let result = {
                name: '',
                brand: '',
                price: 0,
                originalPrice: 0,
                unit: '',
                images: [],
                description: '',
                highlights: '',
            };

            // 1. JSON-LD extraction
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.innerText);
                    const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
                    for (const item of items) {
                        if (item['@type'] === 'Product') {
                            result.name = item.name || result.name;
                            result.brand = (item.brand && item.brand.name) || item.brand || result.brand;
                            if (item.description && item.description.length > result.description.length) {
                                result.description = item.description;
                            }

                            if (item.image) {
                                if (Array.isArray(item.image)) {
                                    result.images.push(...item.image);
                                } else if (typeof item.image === 'string') {
                                    result.images.push(item.image);
                                } else if (item.image.url) {
                                    result.images.push(item.image.url);
                                }
                            }

                            if (item.offers) {
                                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                                if (offer && offer.price) {
                                    result.price = parseFloat(offer.price) || result.price;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            // 2. Open Graph & Meta Fallbacks
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
            const ogImage = document.querySelector('meta[property="og:image"]')?.content;
            if (ogImage && !result.images.includes(ogImage)) {
                result.images.unshift(ogImage);
            }

            // 3. Name resolution
            const h1 = document.querySelector('h1')?.innerText?.trim();
            if (h1 && (!result.name || result.name.toLowerCase().includes('buy ') || h1.length > result.name.length)) {
                result.name = h1;
            } else if (!result.name && ogTitle) {
                result.name = ogTitle;
            } else if (!result.name) {
                result.name = document.title;
            }

            // Clean Name: remove store tags, Bakery Delight suffix, Buy prefix
            if (result.name) {
                result.name = result.name
                    .replace(/\s*\|\s*Bakery Delight/i, '')
                    .replace(/^Buy\s+/i, '')
                    .replace(/\s*-\s*Buy\s+at.*$/i, '')
                    .replace(/\s*Online.*$/i, '')
                    .replace(/\s*-\s*Zepto.*$/i, '')
                    .replace(/\s*\|\s*Blinkit.*$/i, '')
                    .replace(/\s*\(\d+[^)]*\)$/, '')
                    .trim();
            }

            const bodyText = document.body.innerText || '';

            // 4. Price resolution
            if (!result.price || result.price === 0) {
                const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.content ||
                                  document.querySelector('meta[name="twitter:data1"]')?.content;
                if (metaPrice) result.price = parseFloat(metaPrice) || 0;
            }
            if (!result.price || result.price === 0) {
                // Regex on body near ₹
                const priceMatch = bodyText.match(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)/);
                if (priceMatch) result.price = parseFloat(priceMatch[1]);
            }

            // 5. MRP (Original Price) resolution
            const mrpMatch = bodyText.match(/MRP[\s\S]{0,35}?(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)/i) ||
                             bodyText.match(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)\s*[\n\r]*\s*MRP/i);
            if (mrpMatch) {
                const parsed = parseFloat(mrpMatch[1]);
                if (parsed >= result.price) result.originalPrice = parsed;
            }

            // Next.js script / App Router tag check for MRP & Unit
            try {
                const nextData = document.getElementById('__NEXT_DATA__');
                let jsonStr = nextData ? nextData.innerText : '';
                if (!jsonStr) {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const s of scripts) {
                        if (s.innerText.includes('self.__next_f') || s.innerText.includes('"mrp"')) {
                            jsonStr += s.innerText + '\n';
                        }
                    }
                }
                if (jsonStr) {
                    const mrpMatch = jsonStr.match(/"mrp"\s*:\s*(\d+(?:\.\d+)?)/i) ||
                                     jsonStr.match(/"originalPrice"\s*:\s*(\d+(?:\.\d+)?)/i);
                    if (mrpMatch) {
                        let val = parseFloat(mrpMatch[1]);
                        if (val > result.price * 10) val = val / 100; // Handle paise (e.g. 3000 -> 30)
                        if (val >= result.price && result.originalPrice === 0) {
                            result.originalPrice = val;
                        }
                    }
                    if (!result.unit || result.unit === '1pc') {
                        const unitMatch = jsonStr.match(/"(?:formattedPackSize|formattedPacksize|unit|weight)"\s*:\s*\\?"([^"\\]+)\\?"/i) ||
                                         jsonStr.match(/"(?:weight|pack_size)"\s*:\s*\\?"([^"\\]+)\\?"/i);
                        if (unitMatch && unitMatch[1].length < 20) result.unit = unitMatch[1];
                    }
                }
            } catch (e) {}

            if (!result.originalPrice || result.originalPrice < result.price) {
                result.originalPrice = result.price;
            }

            // 6. Unit resolution
            // Priority 1: Zepto Net Qty
            const netQtyMatch = bodyText.match(/Net\s*Qty:?\s*([^\n•]+)/i);
            if (netQtyMatch) {
                result.unit = netQtyMatch[1].trim();
            }
            // Priority 2: Text immediately following product name in bodyText
            if (!result.unit || result.unit === '1pc') {
                if (result.name) {
                    const idx = bodyText.indexOf(result.name);
                    if (idx !== -1) {
                        const nearby = bodyText.substring(idx + result.name.length, idx + result.name.length + 150);
                        const nearbyMatch = nearby.match(/(\d+(?:\.\d+)?\s*(?:kg|g|mg|l|ml|pc|pcs|pack|packs))/i);
                        if (nearbyMatch) result.unit = nearbyMatch[1].trim();
                    }
                }
            }
            // Priority 3: Title unit in parentheses
            if (!result.unit || result.unit === '1pc') {
                const titleMatch = document.title.match(/\(([^)]*(?:g|kg|ml|l|pc|pcs|pack)[^)]*)\)/i);
                if (titleMatch) result.unit = titleMatch[1].trim();
            }
            // Priority 4: Default fallback
            if (!result.unit) result.unit = '1pc';

            // 7. Collect High-Res Images
            // If JSON-LD or og:image already provided product images, use their filenames/slugs to filter DOM matches
            const htmlSource = document.documentElement.innerHTML;
            const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
            const matches = htmlSource.match(urlRegex) || [];

            // Extract primary slug keywords from product name (excluding brand names)
            const commonBrands = ['britannia', 'amul', 'nestle', 'cadbury', 'parle', 'tata', 'haldiram', 'itc', 'sunfeast', 'dabur', 'marico'];
            const nameKeywords = (result.name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .split(' ')
                .filter(w => w.length > 3 && !commonBrands.includes(w));
            
            for (const m of matches) {
                const lowerM = m.toLowerCase();
                if (m.includes('cms-assets/cms/product/')) {
                    result.images.push(m);
                } else if (m.includes('product_variant') || m.includes('cms/product/')) {
                    // Only include if it contains at least one product-specific keyword
                    if (nameKeywords.length === 0 || nameKeywords.some(kw => lowerM.includes(kw))) {
                        result.images.push(m);
                    }
                }
            }

            const normalizeUrl = (url) => {
                if (!url) return url;
                if (url.includes('/_next/image')) {
                    try {
                        const parsed = new URL(url, 'https://blinkit.com');
                        const inner = parsed.searchParams.get('url');
                        if (inner) url = inner;
                    } catch(e){}
                }
                return decodeURIComponent(url)
                    .replace(/\/cdn-cgi\/image\/[^\/]+\//, '/')
                    .replace(/\/tr:[^\/]+\//, '/');
            };
            result.images = [...new Set(result.images.map(normalizeUrl))].filter(u => 
                !u.includes('blur') && !u.includes('base64') && !u.includes('icon') && !u.includes('logo')
            );

            // 8. Description & Highlights extraction (Stop before footer / recommendations)
            const stopRegex = /(similar products|related products|people also bought|customers also bought|explore more|trending searches|popular searches|bestsellers|delivery areas|footer|get it on|download app|buy online with fast|customer care|seller name|country of origin|why shop from)/i;
            
            if (!result.description || result.description.length < 50) {
                const allElements = Array.from(document.querySelectorAll('h2, h3, h4, p, li, div'));
                let inDesc = false;
                let descParts = [];
                for (const el of allElements) {
                    const text = el.innerText?.trim();
                    if (!text) continue;
                    if (stopRegex.test(text)) {
                        inDesc = false;
                        break;
                    }
                    const lower = text.toLowerCase();
                    if (lower.includes('product details') || lower === 'about the product' || lower === 'highlights' || lower === 'key features') {
                        inDesc = true;
                        continue;
                    }
                    if (inDesc && el.children.length === 0 && text.length > 10) {
                        if (!descParts.some(p => p.includes(text) || text.includes(p))) {
                            descParts.push(text);
                        }
                    }
                }
                if (descParts.length > 0) result.description = descParts.join('\n\n');
            }

            // Highlights
            if (!result.highlights) {
                const hlHeader = Array.from(document.querySelectorAll('h2, h3, h4, div')).find(el => 
                    el.innerText && /^(highlights|key features)$/i.test(el.innerText.trim())
                );
                if (hlHeader) {
                    let next = hlHeader.nextElementSibling;
                    let hlParts = [];
                    while (next && hlParts.length < 5) {
                        const txt = next.innerText?.trim();
                        if (txt && !stopRegex.test(txt) && txt.length > 5 && txt.length < 200) {
                            hlParts.push(txt);
                        }
                        next = next.nextElementSibling;
                    }
                    if (hlParts.length > 0) result.highlights = hlParts.join('\n');
                }
            }

            // Clean app names from description and highlights
            const cleanText = (str) => {
                if (!str) return '';
                return str.replace(/(Blinkit|Zepto|Grofers|Swiggy|Instamart|Zomato|BigBasket)/gi, '')
                          .replace(/[a-zA-Z0-9._%+-]+@(zeptonow\.com|blinkit\.com|zomato\.com|swiggy\.com|bigbasket\.com)/gi, 'support@shravanprovision.com')
                          .trim();
            };

            result.description = cleanText(result.description);
            result.highlights = cleanText(result.highlights);

            return result;
        });

        if (data.name && (data.name.includes('Access Denied') || data.name.includes('Just a moment...'))) {
            throw new Error("Blocked by Bot Protection (Access Denied). Cannot scrape this link.");
        }

        return {
            Barcode: '',
            Name: data.name ? data.name.trim().substring(0, 100) : 'Unknown Product',
            Brand: '',
            Price: parseFloat(data.price) || 0,
            OriginalPrice: parseFloat(data.originalPrice) || parseFloat(data.price) || 0,
            Stock: 50,
            Unit: data.unit || '1pc',
            Category: '',
            Subcategory: '',
            ItemGroup: '',
            Description: data.description ? data.description.trim() : '',
            Highlights: data.highlights ? data.highlights.trim() : '',
            Images: (data.images || []).filter(Boolean).join('|'),
            ImageURL1: data.images[0] || '',
            ImageURL2: data.images[1] || '',
            ImageURL3: data.images[2] || '',
            ImageURL4: data.images[3] || '',
            ImageURL5: data.images[4] || '',
            ImageURL6: data.images[5] || '',
            ImageURL7: data.images[6] || '',
            ImageURL8: data.images[7] || '',
            ImageURL9: data.images[8] || '',
            ImageURL10: data.images[9] || '',
            ImageURL11: data.images[10] || '',
            ImageURL12: data.images[11] || '',
            ImageURL13: data.images[12] || '',
            ImageURL14: data.images[13] || '',
            ImageURL15: data.images[14] || '',
        };

    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error.message);
        return null;
    }
}

async function main() {
    if (!fs.existsSync(LINKS_FILE)) {
        console.log(`Please create a file named 'links.txt' in ${__dirname} and paste URLs line by line.`);
        fs.writeFileSync(LINKS_FILE, 'https://example.com/product/1\n');
        return;
    }

    const links = fs.readFileSync(LINKS_FILE, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && (l.startsWith('http') || l.startsWith('file')));

    if (links.length === 0) {
        console.log('No valid URLs found in links.txt');
        return;
    }

    console.log(`Found ${links.length} URLs to scrape.`);

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--headless=new',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-size=1920,1080',
        ]
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        extraHTTPHeaders: {
            'Accept-Language': 'en-IN,en;q=0.9',
            'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
        }
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const results = [];

    for (const link of links) {
        const productData = await extractProductData(page, link);
        if (productData) {
            results.push(productData);
        }
    }

    await browser.close();

    if (results.length > 0) {
        const csv = Papa.unparse(results, {
            columns: [
                'Barcode', 'Name', 'Brand', 'Price', 'OriginalPrice', 'Stock', 'Unit',
                'Category', 'Subcategory', 'ItemGroup', 'Description', 'Highlights', 'Images',
                'ImageURL1', 'ImageURL2', 'ImageURL3', 'ImageURL4',
                'ImageURL5', 'ImageURL6', 'ImageURL7', 'ImageURL8',
                'ImageURL9', 'ImageURL10', 'ImageURL11', 'ImageURL12',
                'ImageURL13', 'ImageURL14', 'ImageURL15'
            ]
        });
        fs.writeFileSync(OUTPUT_FILE, csv);
        console.log(`\nSuccess! Wrote ${results.length} products to ${OUTPUT_FILE}`);
        console.log(`You can now upload this file in your Admin Panel -> Import CSV.`);
    } else {
        console.log('\nNo data was extracted.');
    }
}

main().catch(console.error);
