import { describe, it, expect } from 'vitest';
import { autoMapColumns, buildTemplateCsv, runWithConcurrency, validateImportRows, type CatalogLookups } from './productCsv';

const CAT_SNACKS = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const CAT_DAIRY = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const SUB_CHIPS = 'bbbbbbbbbbbbbbbbbbbbbbb1';
const SUB_MILK = 'bbbbbbbbbbbbbbbbbbbbbbb2';
const GRP_POTATO = 'ccccccccccccccccccccccc1';

const catalog: CatalogLookups = {
    categories: [
        { _id: CAT_SNACKS, name: 'Snacks & Munchies' },
        { _id: CAT_DAIRY, name: 'Dairy' },
    ],
    subcategories: [
        { _id: SUB_CHIPS, name: 'Chips', parentId: CAT_SNACKS },
        { _id: SUB_MILK, name: 'Milk', parentId: CAT_DAIRY },
    ],
    itemGroups: [{ _id: GRP_POTATO, name: 'Potato chips', subcategoryId: SUB_CHIPS }],
};

const headers = ['Name', 'Price', 'MRP', 'Stock', 'Unit', 'Category', 'Subcategory', 'ItemGroup', 'Images', 'Barcode'];
const mapping = autoMapColumns(headers);

const base = {
    Name: 'Classic Salted',
    Price: '20',
    MRP: '25',
    Stock: '5',
    Unit: '52 g',
    Category: 'snacks & munchies',
    Subcategory: 'chips',
    ItemGroup: 'Potato Chips',
    Images: 'https://x.test/a.jpg',
    Barcode: '',
};

describe('autoMapColumns', () => {
    it('maps template and common header names', () => {
        expect(mapping).toMatchObject({ name: 'Name', price: 'Price', mrp: 'MRP', category: 'Category', subcategory: 'Subcategory', itemGroup: 'ItemGroup', images: 'Images' });
        expect(autoMapColumns(['Product Name', 'Selling Price', 'Pack Size', 'OriginalPrice'])).toMatchObject({
            name: 'Product Name',
            price: 'Selling Price',
            unit: 'Pack Size',
            mrp: 'OriginalPrice',
        });
    });
});

describe('validateImportRows', () => {
    it('resolves category, subcategory and item group names to ids', () => {
        const [row] = validateImportRows([base], mapping, catalog);
        expect(row.errors).toEqual([]);
        expect(row.data).toMatchObject({
            name: 'Classic Salted',
            price: 20,
            originalPrice: 25,
            stock: 5,
            unit: '52 g',
            categoryId: CAT_SNACKS,
            subcategoryId: SUB_CHIPS,
            itemGroupId: GRP_POTATO,
            status: 'active',
        });
    });

    it('never passes unresolved names through as ids', () => {
        const rows = validateImportRows(
            [
                { ...base, Subcategory: 'Milk' }, // exists, but under Dairy
                { ...base, ItemGroup: 'Corn chips' },
                { ...base, Category: 'Frozen' },
                { ...base, Subcategory: 'bbbbbbbbbbbbbbbbbbbbbbb9' }, // unknown id
            ],
            mapping,
            catalog,
        );
        rows.forEach((r) => expect(r.data).toBeUndefined());
        expect(rows[0].errors[0]).toMatch(/Subcategory "Milk" was not found in "Snacks & Munchies"/);
        expect(rows[1].errors[0]).toMatch(/Item group "Corn chips" was not found/);
        expect(rows[2].errors[0]).toMatch(/Category "Frozen" was not found/);
        expect(rows[3].errors[0]).toMatch(/does not exist/);
    });

    it('rejects missing unit, bad numbers, MRP below price, bad images and duplicate barcodes', () => {
        const rows = validateImportRows(
            [
                { ...base, Unit: '' },
                { ...base, Price: '0' },
                { ...base, MRP: '10' },
                { ...base, Stock: '1.5' },
                { ...base, Images: 'javascript:alert(1)' },
                { ...base, Barcode: '890100' },
                { ...base, Barcode: '890100' },
                { ...base, Name: '' },
            ],
            mapping,
            catalog,
        );
        expect(rows.map((r) => r.errors.length > 0)).toEqual([true, true, true, true, true, false, true, true]);
        expect(rows[6].errors[0]).toMatch(/also on row 6/);
    });

    it('imports rows without an image as drafts and flags barcode-like units', () => {
        const [noImage, barcodeUnit] = validateImportRows([{ ...base, Images: '' }, { ...base, Unit: '8047675773 G' }], mapping, catalog);
        expect(noImage.status).toBe('draft');
        expect(noImage.data?.status).toBe('draft');
        expect(noImage.warnings[0]).toMatch(/draft/);
        expect(barcodeUnit.errors).toEqual([]);
        expect(barcodeUnit.warnings[0]).toMatch(/looks like a barcode/);
    });

    it('accepts ₹ and thousands separators in prices', () => {
        const [row] = validateImportRows([{ ...base, Price: '₹1,299', MRP: '1,499.00' }], mapping, catalog);
        expect(row.data).toMatchObject({ price: 1299, originalPrice: 1499 });
    });
});

describe('buildTemplateCsv', () => {
    it('uses the headers the importer maps automatically', () => {
        const [header] = buildTemplateCsv('Dairy').split('\n');
        const auto = autoMapColumns(header.split(','));
        expect(Object.keys(auto)).toHaveLength(16);
    });
});

describe('runWithConcurrency', () => {
    it('never exceeds the limit and processes every item', async () => {
        let active = 0;
        let peak = 0;
        const seen: number[] = [];
        await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => setTimeout(r, 5));
            seen.push(n);
            active--;
        });
        expect(peak).toBeLessThanOrEqual(3);
        expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('stops starting new work after abort', async () => {
        const controller = new AbortController();
        const seen: number[] = [];
        await runWithConcurrency(
            [1, 2, 3, 4, 5],
            1,
            async (n) => {
                seen.push(n);
                if (n === 2) controller.abort();
            },
            controller.signal,
        );
        expect(seen).toEqual([1, 2]);
    });
});
