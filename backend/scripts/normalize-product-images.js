/**
 * Batch "pack shot" normalisation of existing product images: optional
 * background removal (PRODUCT_IMAGE_BG_PROVIDER) + trim, square transparent
 * canvas, max 800px PNG. Uses the same pipeline as the API
 * (src/modules/products/image-processing/product-image-pipeline.ts).
 *
 * Dry run by default (reports what would change, no writes, no provider calls).
 *
 * Run from backend/:
 *   node --env-file=.env scripts/normalize-product-images.js                 # dry run
 *   node --env-file=.env scripts/normalize-product-images.js --apply --limit 20
 *
 * Flags:
 *   --dry-run          report only (default)
 *   --apply            process and write to MongoDB
 *   --limit N          process at most N products
 *   --include-urls     also download http(s) image URLs (public hosts only) and
 *                      store the result as a PNG data URI; by default only
 *                      base64 data-URI uploads are processed
 *   --force            re-process products already marked imageProcessed
 *                      (default: only products missing the marker)
 *
 * Env: MONGODB_URI (required), PRODUCT_IMAGE_BG_PROVIDER, REMOVE_BG_API_KEY,
 *      REMBG_BIN, PRODUCT_IMAGE_TIMEOUT_MS.
 */

const path = require('path');
const mongoose = require('mongoose');

function loadPipeline() {
    // Prefer the compiled module (npm run build); fall back to ts-node on the source.
    try {
        return require(path.join(__dirname, '../dist/modules/products/image-processing/product-image-pipeline.js'));
    } catch {
        require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
        return require(path.join(__dirname, '../src/modules/products/image-processing/product-image-pipeline.ts'));
    }
}

function parseArgs(argv) {
    const args = { apply: false, limit: 0, includeUrls: false, force: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--apply') args.apply = true;
        else if (a === '--dry-run') args.apply = false;
        else if (a === '--include-urls') args.includeUrls = true;
        else if (a === '--force') args.force = true;
        else if (a === '--only-missing') args.force = false;
        else if (a === '--limit') args.limit = parseInt(argv[++i], 10) || 0;
        else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice(8), 10) || 0;
        else {
            console.error(`Unknown argument: ${a}`);
            process.exit(1);
        }
    }
    return args;
}

const isUrl = (v) => /^https?:\/\//i.test(v);
const kb = (n) => `${Math.round(n / 1024)}KB`;

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not set. Example: node --env-file=.env scripts/normalize-product-images.js --dry-run');
        process.exit(1);
    }

    const pipeline = loadPipeline();
    const config = pipeline.resolvePipelineConfig(process.env);
    const deps = { logger: { warn: (m) => console.warn(`   ! ${m}`) } };

    console.log(`Mode: ${args.apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`);
    console.log(`Provider: ${config.provider}${pipeline.isBgRemovalEnabled(config) ? '' : ' (background removal off; normalising only)'}`);
    console.log(`Sources: data-URI uploads${args.includeUrls ? ' + http(s) URLs' : ''}`);

    await mongoose.connect(MONGODB_URI);
    const products = mongoose.connection.collection('products');

    const filter = {
        $or: [{ image: { $nin: [null, ''] } }, { 'images.0': { $exists: true } }],
    };
    if (!args.force) filter.imageProcessed = { $ne: true };

    const cursor = products
        .find(filter, { projection: { name: 1, image: 1, images: 1 } })
        .sort({ _id: 1 });
    if (args.limit > 0) cursor.limit(args.limit);

    const stats = { seen: 0, changed: 0, skipped: 0, failed: 0 };
    try {
        for await (const p of cursor) {
            stats.seen++;
            const images = Array.isArray(p.images) && p.images.length ? p.images : p.image ? [p.image] : [];
            const candidates = images.filter((v) => pipeline.isDataUri(v) || (args.includeUrls && isUrl(v)));
            if (!candidates.length) {
                stats.skipped++;
                console.log(`- ${p._id} ${p.name}: nothing to process (${images.length} non-upload image(s))`);
                continue;
            }

            if (!args.apply) {
                stats.changed++;
                const sizes = candidates.map((v) => (pipeline.isDataUri(v) ? kb(v.length) : 'url')).join(', ');
                console.log(`~ ${p._id} ${p.name}: would process ${candidates.length} image(s) [${sizes}]`);
                continue;
            }

            const cache = new Map();
            let allOk = true;
            const convert = async (v) => {
                if (!(pipeline.isDataUri(v) || (args.includeUrls && isUrl(v)))) {
                    if (v) allOk = false;
                    return v;
                }
                if (cache.has(v)) return cache.get(v);
                try {
                    const r = await pipeline.processImage(v, config, deps, { removeBackground: true });
                    if (config.provider !== 'none' && !r.backgroundRemoved) allOk = false;
                    cache.set(v, r.dataUri);
                    return r.dataUri;
                } catch (err) {
                    allOk = false;
                    console.warn(`   ! ${p._id}: ${err.message}`);
                    cache.set(v, v);
                    return v;
                }
            };

            const newImages = [];
            for (const v of images) newImages.push(await convert(v));
            const newImage = p.image ? await convert(p.image) : newImages[0];
            const changed = newImages.some((v, i) => v !== images[i]) || newImage !== p.image;

            if (!changed) {
                stats.failed++;
                console.log(`x ${p._id} ${p.name}: processing failed, left unchanged`);
                continue;
            }
            await products.updateOne(
                { _id: p._id },
                { $set: { image: newImage, images: newImages, imageProcessed: allOk, updatedAt: new Date() } },
            );
            stats.changed++;
            console.log(`✓ ${p._id} ${p.name}: ${candidates.length} image(s) normalised${allOk ? '' : ' (partial)'}`);
        }
    } finally {
        await mongoose.connection.close();
    }

    console.log(
        `\nDone. seen=${stats.seen} ${args.apply ? 'updated' : 'would-update'}=${stats.changed} skipped=${stats.skipped} failed=${stats.failed}`,
    );
    if (!args.apply && stats.changed) console.log('Re-run with --apply to write changes.');
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
