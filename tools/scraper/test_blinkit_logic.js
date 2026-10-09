const htmlSource = require('fs').readFileSync('tools/scraper/blinkit_page.html', 'utf8');

const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
const matches = htmlSource.match(urlRegex) || [];

let imgs = matches.filter(src => {
    if (!src) return false;
    
    // Blinkit/Grofers specific:
    if (src.includes('cms-assets/cms/product/')) return true;

    const isHighResUrl = (src.includes('1000x1000') || src.includes('500x500') || src.includes('w=1080') || src.includes('w=828') || src.includes('w=480') || src.includes('w=540')) && !src.includes('w=128') && !src.includes('w=256');
    return isHighResUrl;
});

const normalizeUrl = (url) => {
    if (!url) return url;
    if (url.includes('/_next/image')) {
        try {
            const parsed = new URL(url, 'https://blinkit.com');
            const innerUrl = parsed.searchParams.get('url');
            if (innerUrl) url = innerUrl;
        } catch(e){}
    }
    // Remove query params or resize flags for consistency
    let clean = url.replace(/w=\d+,?/, '').replace(/h=\d+,?/, '').replace(/q=\d+,?/, '').replace(/fit=[^,]+,?/, '').replace(/metadata=[^,]+,?/, '').replace(/f=[^,]+,?/, '');
    clean = clean.replace(/\/cdn-cgi\/image\/[^\/]+\//, '/');
    return clean.split('?')[0];
};

let finalUrls = Array.from(new Set(imgs.map(normalizeUrl)));
console.log(finalUrls);
