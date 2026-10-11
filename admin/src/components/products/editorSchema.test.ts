import { describe, expect, it } from 'vitest';
import { emptyProductForm, mapServerMessage, productSchema, productToForm, toProductPayload, unitLooksLikeBarcode } from './editorSchema';
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
});
