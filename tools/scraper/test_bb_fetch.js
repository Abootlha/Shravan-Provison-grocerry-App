async function test() {
    const res = await fetch('https://www.bigbasket.com/pd/40289841/parle-g-oats-berries-cookies-9375-g/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    if (html.includes('__NEXT_DATA__')) {
        console.log("NEXT_DATA found!");
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (match) {
            const data = JSON.parse(match[1]);
            const product = data.props.pageProps.b2cProduct;
            if (product) {
                console.log("Product Name:", product.desc);
                console.log("Price:", product.pricing.discount.mrp);
                console.log("Images:", product.images);
            } else {
                console.log("b2cProduct not found in NEXT_DATA");
            }
        }
    } else {
        console.log("Blocked or structure changed. HTML excerpt:", html.substring(0, 500));
    }
}
test();
