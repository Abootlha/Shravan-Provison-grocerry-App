# Legacy CSV scraper

This CLI (`node index.js`, reads `links.txt`, writes `output.csv`) is the old way of
importing products. It is superseded by **Admin > Product scraper**, which runs in the
backend (`backend/src/modules/scraper`): paste links in the admin, review each preview
(photos stored in Cloudflare R2, suggested category), then approve or decline.

The CSV output still works with Admin > Products > Import if you need it offline.
