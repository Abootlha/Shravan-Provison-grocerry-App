const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('blinkit_dom.html', 'utf-8'); // This is blocked HTML. We need the unblocked one!
