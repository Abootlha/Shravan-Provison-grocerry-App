import { describe, expect, it } from 'vitest';
import { emptyProductForm, looksFreshCategory, mapServerMessage, productSchema, productToForm, toProductPayload, unitLooksLikeBarcode } from './editorSchema';
import type { AdminProduct } from './types';

const CAT = 'aaaaaaaaaaaaaaaaaaaaaaa1';

const product: AdminProduct = {
    _id: 'p1',
    name: 'Toor Dal',
    categoryId: { _id: CAT, name: 'Dal' },
    subcategoryId: null,
    price: 140,
    originalPrice: 160,
    unit: '1 kg',
    stock: 12,
    reorderLevel: 10,
    images: ['https://x.test/a.jpg'],
    image: 'https://x.test/a.jpg',
    isAvailable: false,
    status: 'active',
};

describe('productSchema', () => {
    it('requires price above 0, an image and a unit for active products', () => {
        const res = productSchema.safeParse({ ...emptyProductForm('active'), name: 'X', categoryId: CAT, price: 0 });
        expect(res.success).toBe(false);
        const paths = res.error!.issues.map((i) => i.path[0]);
        expect(paths).toEqual(expect.arrayContaining(['price', 'images', 'unit']));
    });

    it('lets a draft be saved without an image or price above 0', () => {
        const res = productSchema.safeParse({ ...emptyProductForm('draft'), name: 'X', categoryId: CAT, price: 0, unit: '1 kg' });
        expect(res.success).toBe(true);
    });

    it('rejects MRP below the selling price and non-https image links', () => {
        const res = productSchema.safeParse({ ...productToForm(product), mrp: 100, images: ['ftp://x'] });
        expect(res.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['mrp', 'images']));
    });
});

describe('toProductPayload', () => {
    it('sends only changed fields on edit and never isAvailable unless it changed', () => {
        const values = productSchema.parse({ ...productToForm(product), price: 150 });
        expect(toProductPayload(values, { price: true })).toEqual({ price: 150 });
    });

    it('sends null to clear a subcategory (and its item group) on edit', () => {
        const values = productSchema.parse({ ...productToForm(product), subcategoryId: '' });
        expect(toProductPayload(values, { subcategoryId: true })).toEqual({ subcategoryId: null, itemGroupId: null });
    });

    it('builds a full create body with stock and without empty optionals', () => {
        const values = productSchema.parse({ ...emptyProductForm('draft'), name: 'New', categoryId: CAT, price: 10, unit: '1 pc', stock: 3 });
        const body = toProductPayload(values);
        expect(body).toMatchObject({ name: 'New', categoryId: CAT, price: 10, originalPrice: 10, unit: '1 pc', stock: 3, status: 'draft', images: [], image: '' });
        expect(body).not.toHaveProperty('isAvailable');
        expect(body).not.toHaveProperty('subcategoryId');
        expect(body).not.toHaveProperty('brand');
    });
});

describe('helpers', () => {
    it('spots a barcode typed into the unit', () => {
        expect(unitLooksLikeBarcode('8047675773\nG')).toBe(true);
        expect(unitLooksLikeBarcode('500 g')).toBe(false);
    });

    it('maps backend field names to form fields and labels', () => {
        expect(mapServerMessage('originalPrice must not be less than 0')).toEqual({ field: 'mrp', message: 'MRP must not be less than 0' });
        expect(mapServerMessage('Something else broke')).toEqual({ message: 'Something else broke' });
    });

    it('recognises fresh produce and dairy categories', () => {
        expect(looksFreshCategory('Fruits & Vegetables')).toBe(true);
        expect(looksFreshCategory('Dairy, Bread & Eggs')).toBe(true);
        expect(looksFreshCategory('Tea , Coffee & Milk')).toBe(false);
        expect(looksFreshCategory('Bakery & Biscuits')).toBe(false);
        expect(looksFreshCategory(undefined)).toBe(false);
    });
});

describe('pack sizes (variants)', () => {
    const withVariants: AdminProduct = {
        ...product,
        variants: [
            { sku: 'DAL-1', unit: '1 kg', mrp: 160, sellingPrice: 140, stock: 12, isDefault: true, isActive: true },
            { sku: 'DAL-5', unit: '5 kg', mrp: 760, sellingPrice: 650, stock: 4, isDefault: false },
        ],
    };

    it('loads the stored pack sizes into the form', () => {
        expect(productToForm(withVariants).variants).toEqual([
            { sku: 'DAL-1', unit: '1 kg', mrp: 160, sellingPrice: 140, stock: 12, isDefault: true, isActive: true },
            { sku: 'DAL-5', unit: '5 kg', mrp: 760, sellingPrice: 650, stock: 4, isDefault: false, isActive: true },
        ]);
    });

    it('rejects duplicate SKUs, a price above MRP and two defaults', () => {
        const form = productToForm(withVariants);
        const res = productSchema.safeParse({
            ...form,
            variants: [form.variants[0], { ...form.variants[1], sku: 'dal-1', sellingPrice: 800, isDefault: true }],
        });
        expect(res.success).toBe(false);
        const paths = res.error!.issues.map((i) => i.path.join('.'));
        expect(paths).toEqual(expect.arrayContaining(['variants.1.sku', 'variants.1.sellingPrice', 'variants']));
    });

    it('sends the whole list only when it changed', () => {
        const values = productSchema.parse({ ...productToForm(withVariants) });
        expect(toProductPayload(values, { price: true })).not.toHaveProperty('variants');
        const body = toProductPayload(values, { variants: true });
        expect(body.variants).toEqual([
            { sku: 'DAL-1', unit: '1 kg', mrp: 160, sellingPrice: 140, stock: 12, isDefault: true, isActive: true },
            { sku: 'DAL-5', unit: '5 kg', mrp: 760, sellingPrice: 650, stock: 4, isDefault: false, isActive: true },
        ]);
    });

    it('creates a product with pack sizes', () => {
        const values = productSchema.parse({
            ...emptyProductForm('draft'),
            name: 'Atta',
            categoryId: CAT,
            price: 249,
            unit: '5 kg',
            variants: [{ sku: 'ATTA-5', unit: '5 kg', mrp: 295, sellingPrice: 249, stock: 50, isDefault: true, isActive: true }],
        });
        expect(toProductPayload(values).variants).toHaveLength(1);
    });
});
