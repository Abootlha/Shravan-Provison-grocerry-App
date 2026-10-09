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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

                    // Extract tabs for extended description
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

                    // Scrub brand name from desc and extendedDesc
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
                        Images: '',
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

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait a bit for dynamic content
        await page.waitForTimeout(3000);

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
            console.log("Could not click view more details");
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
                                // Temporarily store brand to remove it from other fields later
                                result._tempBrand = (item.brand && item.brand.name) || item.brand || result._tempBrand;
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
                // Only push ogImage if it's not a known banner. Banners often have different IDs. 
                // But we can just push it and make sure we don't restrict prefixes to it alone.
                if (ogImage) {
                    result.images.push(ogImage);
                    result._ogImageOnly = true; // flag to avoid restricting prefixes
                }
            }

            // Try to find more images from generic product galleries
            // Filter out small thumbnails (like similar products) by strictly matching main image prefixes
            let imgs = [];
            const prefixes = [];
            for (const imgUrl of result.images) {
                try {
                    let filename = imgUrl.split('?')[0].split('/').pop().split('.')[0];
                    if (filename.includes('rc-upload')) {
                        filename = filename.replace(/-\d+$/, ''); // e.g. rc-upload-1234-91 -> rc-upload-1234
                    }
                    if (filename.length > 5) {
                        prefixes.push(filename);
                    }
                } catch(e){}
            }

            if (prefixes.length > 0 && !result._ogImageOnly) {
                // Search the entire HTML source for URLs matching our main product's prefix
                const htmlSource = document.documentElement.innerHTML;
                const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
                const matches = htmlSource.match(urlRegex) || [];
                imgs = matches.filter(url => 
                    url.includes('cms-assets/cms/product/') || // Always include Blinkit product images
                    prefixes.some(prefix => url.includes(prefix))
                );
            } else {
                // Search the entire HTML source for generic product images (like Blinkit/Grofers)
                const htmlSource = document.documentElement.innerHTML;
                const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
                const matches = htmlSource.match(urlRegex) || [];
                
                // Fallback to DOM traversal if no initial images found
                imgs = Array.from(document.querySelectorAll('img'))
                    .map(img => img.src)
                    .concat(matches)
                    .filter(src => {
                        if (!src) return false;
                        
                        // Blinkit/Grofers specific:
                        if (src.includes('cms-assets/cms/product/')) return true;

                        const isHighResUrl = (src.includes('1000x1000') || src.includes('500x500') || src.includes('w=1080') || src.includes('w=828') || src.includes('w=480') || src.includes('w=540')) && !src.includes('w=128') && !src.includes('w=256');
                        return isHighResUrl;
                    });
            }

            // Normalize URLs to get the highest quality and remove duplicates caused by resizing parameters
            const normalizeUrl = (url) => {
                if (!url) return url;
                
                // If it's a Next.js image URL, decode the 'url' parameter
                if (url.includes('/_next/image')) {
                    try {
                        const parsed = new URL(url, 'https://blinkit.com');
                        const innerUrl = parsed.searchParams.get('url');
                        if (innerUrl) url = innerUrl;
                    } catch(e) {}
                }
                
                // Decode URL encoding just in case
                url = decodeURIComponent(url);
                
                // Strip out Blinkit/Zepto resizing prefixes
                return url
                    .replace(/\/cdn-cgi\/image\/[^\/]+\//, '/') // Grofers/Blinkit
                    .replace(/\/tr:[^\/]+\//, '/');            // Zepto
            };

            result.images = result.images.map(normalizeUrl);
            imgs = imgs.map(normalizeUrl);

            // Filter out clearly invalid/tiny/placeholder images
            imgs = imgs.filter(url => !url.includes('blur') && !url.includes('base64'));

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

                    // Attempt to extract deep descriptions from JSON string
                    const descMatch = jsonStr.match(/"description"\s*:\s*\[?"([^"\\]+)\\?"\]?/i) || jsonStr.match(/"description"\s*:\s*"([^"\\]+)"/i);
                    if (descMatch && descMatch[1] && descMatch[1].length > 10) {
                        result.description = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    }
                    const ingMatch = jsonStr.match(/"ingredients"\s*:\s*"([^"\\]+)"/i);
                    if (ingMatch && ingMatch[1]) {
                        result.description += '\n\nIngredients: ' + ingMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    }
                }
            } catch (e) { }

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
                let highlightsText = result.highlights || '';
                let descriptionText = result.description || '';

                // Try to find the entire "Product Details" container (for Blinkit & Zepto)
                // We look for headers and grab their following sibling contents
                const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span, li'));
                let currentSection = null;
                let extractedSections = {};
                
                for (let i = 0; i < allElements.length; i++) {
                    const el = allElements[i];
                    // Skip hidden elements or extremely long non-headers
                    if (el.innerText && el.innerText.length > 0) {
                        const text = el.innerText.trim();
                        const lower = text.toLowerCase();
                        
                        // Filter out unwanted app names and seller details (but keep product details, license, address per user request)
                        const unwantedRegex = /(blinkit|zepto|grofers|swiggy|instamart|zomato|bigbasket|return policy|seller details|useful links|express delivery|round-the-clock|download app|genuine products|best prices)/i;
                        if (unwantedRegex.test(lower)) {
                            // If this was a section header (e.g. "Useful Links"), stop adding to current section
                            if (el.tagName.match(/^H[1-6]$/) || (el.tagName === 'DIV' && el.children.length === 0 && text.length < 50)) {
                                currentSection = null;
                            }
                            continue;
                        }

                        // Detect Section Headers
                        if (el.tagName.match(/^H[1-6]$/) || (el.tagName === 'DIV' && el.children.length === 0 && text.length < 50 && (el.className.includes('title') || el.className.includes('head')))) {
                            if (lower === 'highlights' || lower === 'key features') {
                                currentSection = 'highlights';
                                continue;
                            } else if (lower.includes('product details') || lower === 'about the product' || lower === 'information' || lower === 'description' || lower === 'ingredients' || lower === 'key information') {
                                currentSection = 'description';
                                // Include the header as part of the description to structure it nicely
                                if (!extractedSections[currentSection]) extractedSections[currentSection] = [];
                                extractedSections[currentSection].push(text);
                                continue;
                            }
                        }

                        // Add content to current section if it's a leaf node or small container
                        if (currentSection && el.children.length === 0 && text.length > 10 && !text.includes('Product Details')) {
                            if (!extractedSections[currentSection]) extractedSections[currentSection] = [];
                            // Avoid adding duplicates (sometimes parents and children both have the text)
                            const isDuplicate = extractedSections[currentSection].some(existing => existing.includes(text) || text.includes(existing));
                            if (!isDuplicate) {
                                extractedSections[currentSection].push(text);
                            }
                        }
                    }
                }

                if (extractedSections['highlights'] && extractedSections['highlights'].length > 0) {
                    highlightsText = extractedSections['highlights'].join('\n');
                }
                
                if (extractedSections['description'] && extractedSections['description'].length > 0) {
                    const fullDesc = extractedSections['description'].join('\n');
                    if (!descriptionText.includes(fullDesc.substring(0, 50))) {
                        descriptionText = (descriptionText ? descriptionText + '\n\n' : '') + fullDesc;
                    }
                }

                // Fallback: If still nothing, try the old container method
                if (!descriptionText) {
                    const pdHeader = allElements.find(el => el.innerText && el.innerText.trim().toLowerCase() === 'product details' && el.children.length === 0);
                    if (pdHeader) {
                        let container = pdHeader.parentElement;
                        while (container && container.innerText.length < 100 && container.tagName !== 'BODY') {
                            container = container.parentElement;
                        }
                        if (container) {
                            descriptionText = container.innerText.trim();
                            if (descriptionText.toLowerCase().startsWith('product details')) {
                                descriptionText = descriptionText.substring('product details'.length).trim();
                            }
                        }
                    }
                }

                // If descriptionText contains Highlights inside it, extract it
                if (descriptionText && descriptionText.toLowerCase().includes('highlights') && !highlightsText) {
                    const parts = descriptionText.split(/highlights/i);
                    if (parts.length > 1) {
                        highlightsText = parts[1].trim().split('\n\n')[0].trim();
                    }
                }

                if (highlightsText) {
                    result.highlights = highlightsText;
                }

                if (descriptionText) {
                    let extractedDesc = descriptionText;
                    extractedDesc = extractedDesc.replace(/[a-zA-Z0-9._%+-]+@(zeptonow\.com|blinkit\.com|zomato\.com|swiggy\.com|bigbasket\.com)/gi, 'support@shravankirana.in');
                    result.description = extractedDesc;
                }
            } catch (e) { }

            // Final scrub: Remove brand name and app names from descriptions, but keep Name intact
            const scrubDesc = (str) => {
                if (!str) return str;
                let s = str;
                if (result._tempBrand) {
                    // Remove brand name (case insensitive) from description
                    s = s.replace(new RegExp(result._tempBrand, 'gi'), '');
                }
                // Remove some remaining generic app names just in case
                s = s.replace(/(Blinkit|Zepto|Grofers|Swiggy|Instamart|Zomato|BigBasket)/gi, '');
                // Clean up leading/trailing spaces or weird symbols that might be left
                return s.replace(/^[\s\|\-\,]+/, '').replace(/[\s\|\-\,]+$/, '').trim();
            };

            // Only remove app names from Name (so brand stays intact in Name)
            const scrubName = (str) => {
                if (!str) return str;
                let s = str;
                s = s.replace(/(Blinkit|Zepto|Grofers|Swiggy|Instamart|Zomato|BigBasket)/gi, '');
                return s.replace(/^[\s\|\-\,]+/, '').replace(/[\s\|\-\,]+$/, '').trim();
            };

            result.name = scrubName(result.name);
            result.description = scrubDesc(result.description);
            result.highlights = scrubDesc(result.highlights);
            
            // Delete tempBrand so it doesn't end up in output
            delete result._tempBrand;

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

            // 7. Ultimate Fallback for Name and Price (Zepto specific)
            if (!result.name || result.name.toLowerCase().includes('buy ') || result.name.length > 100) {
                const h1 = document.querySelector('h1');
                if (h1 && h1.innerText.length > 3) {
                    result.name = h1.innerText.trim();
                }
            }
            if (!result.price || result.price === 0) {
                // Find elements containing ₹
                const priceEls = Array.from(document.querySelectorAll('span, p, div, h2, h3, h4'))
                    .filter(el => el.innerText && el.innerText.includes('₹') && el.children.length === 0);
                
                for (const el of priceEls) {
                    const match = el.innerText.match(/₹\s*(\d+(?:\.\d+)?)/);
                    if (match) {
                        const val = parseFloat(match[1]);
                        if (val > 0) {
                            result.price = val;
                            break;
                        }
                    }
                }
            }

            return result;
        });

        if (data.name && (data.name.includes('Access Denied') || data.name.includes('Just a moment...'))) {
            throw new Error("Blocked by Bot Protection (Access Denied). Cannot scrape this link.");
        }

        return {
            Barcode: '',
            Name: data.name ? data.name.trim().substring(0, 100) : 'Unknown Product',
            Brand: '', // Intentionally left empty as per request
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
        .filter(l => l.length > 0 && l.startsWith('http') || l.startsWith('file'));

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
        console.log(`You can now upload this file in your Admin Panel -> Bulk Import.`);
    } else {
        console.log('\nNo data was extracted.');
    }
}

main().catch(console.error);
