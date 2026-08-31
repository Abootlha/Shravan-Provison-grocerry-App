const { chromium } = require('playwright');
const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

const LINKS_FILE = path.join(__dirname, 'links.txt');
const OUTPUT_FILE = path.join(__dirname, 'output.csv');

async function extractProductData(page, url) {
    console.log(`Scraping: ${url}`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait a bit for dynamic content
        await page.waitForTimeout(3000);

        const data = await page.evaluate(() => {
            let result = {
                name: '',
                brand: '',
                price: 0,
                originalPrice: 0,
                unit: '',
                images: [],
                description: '',
            };

            // 1. Try JSON-LD
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.innerText);
                    // Handle array of schemas or single schema
                    const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
                    for (const item of items) {
                        if (item['@type'] === 'Product') {
                            result.name = item.name || result.name;
                            result.brand = (item.brand && item.brand.name) || item.brand || result.brand;
                            result.description = item.description || result.description;
                            
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
                                result.price = offer.price || result.price;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            // 2. Try Open Graph & Meta Tags (Fallback)
            if (!result.name) {
                result.name = document.querySelector('meta[property="og:title"]')?.content || document.title;
            }
            if (!result.price) {
                result.price = document.querySelector('meta[property="product:price:amount"]')?.content || 
                               document.querySelector('meta[name="twitter:data1"]')?.content || '0';
            }
            if (result.images.length === 0) {
                const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                if (ogImage) result.images.push(ogImage);
            }

            // Try to find more images from generic product galleries
            const imgs = Array.from(document.querySelectorAll('img'))
                .filter(img => img.src && (img.src.includes('product') || img.src.includes('item') || (img.width && img.width > 300)))
                .map(img => img.src);

            result.images = [...new Set([...result.images, ...imgs])]; // unique

            // 3. Extract Unit and MRP using Generic Heuristics
            const allTextNodes = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div, li'))
                                   .map(el => el.innerText?.trim())
                                   .filter(text => text && text.length > 0 && text.length < 100);
            
            // Unit parsing
            const unitRegex = /^(\d+(?:\.\d+)?)\s*(kg|g|mg|l|ml|pc|pcs|pack|packs)$/i;
            for (const text of allTextNodes) {
                if (unitRegex.test(text)) {
                    result.unit = text;
                    break;
                }
                const weightMatch = text.match(/(?:weight|net wt|net volume|pack size).*?(\d+(?:\.\d+)?\s*(?:kg|g|mg|l|ml|pc|pcs))/i);
                if (weightMatch) {
                    result.unit = weightMatch[1];
                    break;
                }
            }

            // MRP Parsing
            const strikeNodes = Array.from(document.querySelectorAll('s, strike, del, [class*="strike"], [class*="original-price"], [class*="mrp"]'))
                                     .map(el => el.innerText?.trim());
            for (const text of strikeNodes) {
                const match = text.replace(/[^0-9.]/g, '');
                if (match && parseFloat(match) > result.price) {
                    result.originalPrice = parseFloat(match);
                    break;
                }
            }

            // 4. Fallback to __NEXT_DATA__ or App Router script tags for React apps (Zepto/Blinkit)
            try {
                // Next.js Pages Router
                let jsonStr = '';
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                    jsonStr = nextData.innerText;
                } else {
                    // Next.js App Router (__next_f)
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const s of scripts) {
                        if (s.innerText.includes('self.__next_f') || s.innerText.includes('"mrp"')) {
                            jsonStr += s.innerText + '\n';
                        }
                    }
                }

                if (jsonStr) {
                    if (!result.unit || result.unit === '1pc') {
                        const unitMatch = jsonStr.match(/"(?:formattedPackSize|formattedPacksize|unit|weight)"\s*:\s*\\?"([^"\\]+)\\?"/i) ||
                                          jsonStr.match(/"(?:weight|pack_size)"\s*:\s*\\?"([^"\\]+)\\?"/i);
                        if (unitMatch && unitMatch[1].length < 20) result.unit = unitMatch[1];
                    }
                    
                    const mrpMatch = jsonStr.match(/"mrp"\s*:\s*(\d+(?:\.\d+)?)/i) || 
                                     jsonStr.match(/"originalPrice"\s*:\s*(\d+(?:\.\d+)?)/i) ||
                                     jsonStr.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/i); 
                    
                    if (mrpMatch) {
                        let val = parseFloat(mrpMatch[1]);
                        if (val > result.price * 10) val = val / 100; // Handle paise (e.g. 4500 -> 45.00)
                        if (val > result.price && result.originalPrice === 0) {
                            result.originalPrice = val;
                        }
                    }
                }
            } catch(e) {}

            // 5. Ultimate Fallback: regex on entire body text
            if (!result.unit || result.unit === '1pc') {
                const bodyText = document.body.innerText || '';
                const netQtyMatch = bodyText.match(/Net\s*Qty:?\s*([^\n]+)/i) || 
                                    bodyText.match(/(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|pc|pcs|pack)(?:\s*(?:x|\*)\s*\d+)?)/i);
                if (netQtyMatch && netQtyMatch[1].length < 25) {
                    result.unit = netQtyMatch[1].trim();
                }
            }

            // 6. Extract Highlights/Description
            try {
                let highlightsText = '';
                let descriptionText = '';
                
                const possibleHeaders = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, p, span, h2, h3'));
                
                for (let i = 0; i < possibleHeaders.length; i++) {
                    const el = possibleHeaders[i];
                    const text = (el.innerText || '').trim().toLowerCase();
                    
                    if (text === 'highlights' || text === 'key features') {
                        let contentEl = el.nextElementSibling;
                        if (!contentEl && el.parentElement) contentEl = el.parentElement.nextElementSibling;
                        if (contentEl && !highlightsText) {
                            highlightsText = contentEl.innerText.trim().replace(/\n\n+/g, '\n');
                        }
                    } else if (text === 'product details' || text === 'about the product' || text === 'information') {
                        let contentEl = el.nextElementSibling;
                        if (!contentEl && el.parentElement) contentEl = el.parentElement.nextElementSibling;
                        if (contentEl && !descriptionText) {
                            descriptionText = contentEl.innerText.trim().replace(/\n\n+/g, '\n');
                        }
                    }
                }
                
                // If descriptionText contains Highlights inside it, split it
                if (descriptionText && descriptionText.toLowerCase().includes('highlights')) {
                    const parts = descriptionText.split(/highlights/i);
                    if (parts.length > 1 && !highlightsText) {
                        descriptionText = parts[0].trim();
                        highlightsText = parts[1].trim();
                    }
                }

                if (highlightsText) {
                    result.highlights = highlightsText;
                }
                
                if (descriptionText) {
                    let extractedDesc = descriptionText;
                    extractedDesc = extractedDesc.replace(/[a-zA-Z0-9._%+-]+@(zeptonow\.com|blinkit\.com|zomato\.com|swiggy\.com|bigbasket\.com)/gi, 'support@shravankirana.in');
                    result.description = extractedDesc;
                } else if (result.description) {
                    result.description = result.description.replace(/[a-zA-Z0-9._%+-]+@(zeptonow\.com|blinkit\.com|zomato\.com|swiggy\.com|bigbasket\.com)/gi, 'support@shravankirana.in');
                }
            } catch(e) {}

            if (!result.originalPrice || result.originalPrice <= result.price) {
                const bodyText = document.body.innerText || '';
                const mrpMatch = bodyText.match(/MRP\s*[\n\r]*\s*(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)/i) ||
                                 bodyText.match(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)\s*[\n\r]*\s*MRP/i);
                if (mrpMatch) {
                    const parsed = parseFloat(mrpMatch[1]);
                    if (parsed > result.price) result.originalPrice = parsed;
                }
            }

            if (!result.originalPrice || result.originalPrice < result.price) {
                result.originalPrice = result.price;
            }

            return result;
        });

        return {
            Barcode: '',
            Name: data.name ? data.name.trim().substring(0, 100) : 'Unknown Product',
            Brand: typeof data.brand === 'string' ? data.brand.trim() : '',
            Price: parseFloat(data.price) || 0,
            OriginalPrice: parseFloat(data.originalPrice) || parseFloat(data.price) || 0,
            Stock: 50, // Default bulk stock
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
        .filter(l => l.length > 0 && l.startsWith('http'));

    if (links.length === 0) {
        console.log('No valid URLs found in links.txt');
        return;
    }

    console.log(`Found ${links.length} URLs to scrape.`);
    
    // Install browser binaries if needed. Sometimes playwright needs npx playwright install
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

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
            columns: ['Barcode', 'Name', 'Brand', 'Price', 'OriginalPrice', 'Stock', 'Unit', 'Category', 'Subcategory', 'ItemGroup', 'Description', 'Highlights', 'Images', 'ImageURL1', 'ImageURL2', 'ImageURL3', 'ImageURL4']
        });
        fs.writeFileSync(OUTPUT_FILE, csv);
        console.log(`\nSuccess! Wrote ${results.length} products to ${OUTPUT_FILE}`);
        console.log(`You can now upload this file in your Admin Panel -> Bulk Import.`);
    } else {
        console.log('\nNo data was extracted.');
    }
}

main().catch(console.error);
