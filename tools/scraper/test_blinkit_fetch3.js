async function test() {
    const res = await fetch('https://blinkit.com/prn/britannia-nutrichoice-digestive-high-fibre-biscuit/prid/122263', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const text = await res.text();
    require('fs').writeFileSync('tools/scraper/fetch_dump.html', text);
}
test();
