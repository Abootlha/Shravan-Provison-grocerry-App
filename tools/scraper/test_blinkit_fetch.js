async function test() {
    const res = await fetch('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (match) {
        console.log("Found NEXT_DATA");
        const data = JSON.parse(match[1]);
        // try to find the product info
        const products = data?.props?.pageProps?.initialState?.product?.product;
        if (products) {
            console.log(Object.keys(products));
            const pId = Object.keys(products)[0];
            const p = products[pId];
            console.log("Images:");
            console.log(p.image_url);
            console.log(p.image_urls);
            console.log(p.images);
        } else {
            console.log("No product field in state");
        }
    } else {
        console.log("No NEXT_DATA found");
    }
}
test();
