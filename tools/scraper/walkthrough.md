# Scraper Update: Image Extraction Fix

## Issue Addressed
The scraper was incorrectly extracting only 1 image (usually the banner image) for Blinkit products and ignoring all the actual product images.

## Root Cause
When the script executed, it first successfully found the main banner image via `application/ld+json` (JSON-LD) metadata on the page. Because it successfully found an image here, it assumed this was the main product prefix and aggressively filtered all other images found in the HTML source to match this banner's specific UUID (e.g. `cc4c3635...`).
As a result, all the actual product gallery images (which are named `rc-upload-...`) were ignored.

## Solution Implemented
I modified the image filtering logic in `tools/scraper/index.js` to handle Blinkit's unique image naming scheme:
- Explicitly allowed `cms-assets/cms/product/` images to bypass the strict prefix filtering.
- Ensured all `rc-upload` and UUID-based high-quality images are merged and deduplicated.
- Tested against the provided Blinkit URL: The scraper now successfully downloads all **13 high-quality product images**, along with all comprehensive details like FSSAI License, description, and nutritional facts while successfully stripping the words "Blinkit" and "Grofers".
- Maintained backward compatibility with BigBasket, which successfully extracts all its high-quality `xl` images without polluting with similar product thumbnails.

## Verification
You can verify the output in `output.csv`. The `ImageURL1` through `ImageURL15` columns are now correctly populated with all available product gallery images.
