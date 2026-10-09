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
        console.log(Object.keys(child));
        console.log(child.tabs); // Often details are in 'tabs' or similar
        // Or check if it's in a section like description
        if (child.desc_tabs) {
            console.log("Desc tabs:", child.desc_tabs);
        }
        if (child.about_product) {
            console.log("About:", child.about_product.substring(0, 50));
        }
    }
}
test();
