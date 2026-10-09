const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('blinkit_dom.html', 'utf-8');
const $ = cheerio.load(html);

const texts = [];
$('*').each((i, el) => {
    if ($(el).children().length === 0) {
        const text = $(el).text().trim();
        if (text) texts.push(text);
    }
});
console.log(texts.slice(0, 50).join('\n'));
