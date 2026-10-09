const fs = require('fs');
const htmlSource = fs.readFileSync('tools/scraper/blinkit_page.html', 'utf8');
const urlRegex = /https?:\/\/[^"'\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s>]+)?/gi;
const matches = htmlSource.match(urlRegex) || [];
console.log(matches.filter(m => m.includes('rc-upload')));
