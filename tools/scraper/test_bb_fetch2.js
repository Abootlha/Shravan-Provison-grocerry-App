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
        const keys = Object.keys(data.props.pageProps);
        console.log("pageProps keys:", keys);
        if (data.props.pageProps.productDetails) {
            console.log("productDetails:", Object.keys(data.props.pageProps.productDetails));
            console.log("product name:", data.props.pageProps.productDetails.desc);
            console.log("product price:", data.props.pageProps.productDetails.pricing);
        } else {
             console.log(JSON.stringify(data.props.pageProps).substring(0, 1000));
        }
    }
}
test();
