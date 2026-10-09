async function test() {
    const res = await fetch('https://www.bigbasket.com/pd/40289841/parle-g-oats-berries-cookies-9375-g/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (match) {
        const data = JSON.parse(match[1]);
        const child = data.props.pageProps.productDetails.children[0];
        console.log("Name:", child.desc);
        console.log("Brand:", child.brand.name);
        console.log("Price:", child.pricing.discount.mrp);
        console.log("Weight:", child.weight);
        console.log("Images:", child.images);
    }
}
test();
