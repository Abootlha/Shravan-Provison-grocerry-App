import { z } from 'zod';
import { refId, type AdminProduct, type ProductStatus } from './types';

/**
 * Mirrors backend CreateProductDto / UpdateProductDto (class-validator) plus the catalogue rules
 * from data-architecture §1.2: an active product needs a price above 0, an image and a unit.
 * Drafts can be saved incomplete (the backend still requires name, category, price, unit, stock).
 */

export const MAX_IMAGES = 8;
export const MAX_IMAGE_URL_LENGTH = 2048;
export const MAX_IMAGE_DATA_URI_LENGTH = 1_500_000;
const DATA_URI = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export function imageSourceError(value: string): string | null {
    if (value.startsWith('data:')) {
        if (value.length > MAX_IMAGE_DATA_URI_LENGTH) return 'This upload is too large (max about 1.1 MB after compression).';
        return DATA_URI.test(value) ? null : 'Upload a PNG, JPEG, WebP or GIF image.';
    }
    if (/^https?:\/\//i.test(value)) {
        if (value.length > MAX_IMAGE_URL_LENGTH) return 'Image link is longer than 2048 characters.';
        try {
            new URL(value);
            return null;
        } catch {
            return 'That is not a valid link.';
        }
    }
    if (value.startsWith('/') && !value.startsWith('//')) return null;
    return 'Image links must start with https://';
}

/**
 * Does this category look like fresh produce or dairy? Used to default the perishable switch when a
 * category is picked. Mirrors the backend's isFreshCategory (products.service.ts).
 */
export function looksFreshCategory(name: string | undefined | null): boolean {
    const text = name ?? '';
    return /fruit|vegetable|\bveg|sabzi|produce|herb|dairy|\beggs?\b|bread|\bmilk\b/i.test(text) && !/\btea\b|coffee|biscuit|frozen/i.test(text);
}

/** A unit with 8+ digits is almost always a barcode pasted into the wrong field. */
export function unitLooksLikeBarcode(unit: string | undefined | null): boolean {
    return !!unit && /\d{8,}/.test(unit.replace(/\s+/g, ''));
}

const optionalNumber = (label: string, opts: { min?: number; max?: number; int?: boolean } = {}) =>
    z
        .number({ invalid_type_error: `${label} must be a number` })
        .refine((n) => Number.isFinite(n), `${label} must be a number`)
        .refine((n) => opts.min === undefined || n >= opts.min, `${label} can't be less than ${opts.min}`)
        .refine((n) => opts.max === undefined || n <= opts.max, `${label} can't be more than ${opts.max}`)
        .refine((n) => !opts.int || Number.isInteger(n), `${label} must be a whole number`)
        .optional();

/** One pack size row in the Variants table (mirrors backend ProductVariantDto). */
export const variantSchema = z.object({
    sku: z
        .string()
        .trim()
        .min(1, 'Enter a SKU')
        .max(100, 'SKU must be 100 characters or fewer')
        .regex(/^[\w./-]+$/, 'SKU may only use letters, digits, . _ / -'),
    unit: z.string().trim().min(1, 'Enter the pack size').max(50, 'Pack size must be 50 characters or fewer'),
    mrp: z.number({ invalid_type_error: 'Enter the MRP' }).refine((n) => Number.isFinite(n) && n > 0, 'MRP must be above ₹0'),
    sellingPrice: z
        .number({ invalid_type_error: 'Enter the price' })
        .refine((n) => Number.isFinite(n) && n > 0, 'Price must be above ₹0'),
    stock: z
        .number({ invalid_type_error: 'Enter the stock' })
        .refine((n) => Number.isInteger(n) && n >= 0 && n <= 100_000, 'Stock must be a whole number from 0'),
    isDefault: z.boolean(),
    isActive: z.boolean(),
});
export type VariantFormValues = z.output<typeof variantSchema>;
export const MAX_VARIANTS = 20;

const optionalText = (label: string, max: number) =>
    z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional().default('');

export const productSchema = z
    .object({
        // Basics
        name: z.string().trim().min(1, 'Enter the product name').max(200, 'Name must be 200 characters or fewer'),
        brand: optionalText('Brand', 100),
        barcode: z
            .string()
            .trim()
            .max(32, 'Barcode must be 32 characters or fewer')
            .refine((v) => v === '' || /^[0-9A-Za-z-]+$/.test(v), 'Barcode can only contain letters, digits and dashes')
            .optional()
            .default(''),
        description: optionalText('Description', 5000),
        highlights: optionalText('Highlights', 5000),
        // Pricing
        price: optionalNumber('Selling price', { min: 0 }),
        mrp: optionalNumber('MRP', { min: 0 }),
        gst: optionalNumber('GST', { min: 0, max: 100 }),
        // Media
        images: z.array(z.string()).max(MAX_IMAGES, `Up to ${MAX_IMAGES} images`),
        removeBackground: z.boolean(),
        // Inventory
        unit: z.string().trim().max(50, 'Unit must be 50 characters or fewer'),
        stock: optionalNumber('Opening stock', { min: 0, int: true }),
        reorderLevel: optionalNumber('Reorder level', { min: 0, max: 100_000, int: true }),
        shelfLife: optionalNumber('Shelf life', { min: 0 }),
        storageType: optionalText('Storage', 50),
        isPerishable: z.boolean(),
        // Organisation
        categoryId: z.string().min(1, 'Choose a category'),
        subcategoryId: z.string(),
        itemGroupId: z.string(),
        status: z.enum(['draft', 'active', 'archived']),
        isAvailable: z.boolean(),
        // Nutrition (per serving)
        nutrition: z.object({
            protein: optionalNumber('Protein', { min: 0 }),
            carbs: optionalNumber('Carbs', { min: 0 }),
            sugar: optionalNumber('Sugar', { min: 0 }),
            fat: optionalNumber('Fat', { min: 0 }),
            transFat: optionalNumber('Trans fat', { min: 0 }),
            servingSize: optionalText('Serving size', 50),
        }),
        /** Pack sizes. Empty = the product is sold as one pack (price / unit / stock above). */
        variants: z.array(variantSchema).max(MAX_VARIANTS, `Up to ${MAX_VARIANTS} pack sizes`),
        /** Create only: the editor hides stock on edit (changes go through stock adjustments). */
        isNew: z.boolean(),
    })
    .superRefine((v, ctx) => {
        const active = v.status === 'active';
        if (v.price === undefined) {
            ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a selling price' });
        } else if (active && v.price <= 0) {
            ctx.addIssue({ code: 'custom', path: ['price'], message: 'Active products need a price above ₹0. Save as draft to finish later.' });
        }
        if (v.mrp !== undefined && v.price !== undefined && v.mrp > 0 && v.mrp < v.price) {
            ctx.addIssue({ code: 'custom', path: ['mrp'], message: 'MRP can’t be lower than the selling price' });
        }
        if (!v.unit) {
            ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Enter the pack size, e.g. 500 g or 1 L' });
        }
        if (v.isNew && v.stock === undefined) {
            ctx.addIssue({ code: 'custom', path: ['stock'], message: 'Enter the opening stock (0 is fine)' });
        }
        if (active && v.images.length === 0) {
            ctx.addIssue({ code: 'custom', path: ['images'], message: 'Active products need at least one image. Save as draft to add it later.' });
        }
        v.images.forEach((src, i) => {
            const err = imageSourceError(src);
            if (err) ctx.addIssue({ code: 'custom', path: ['images'], message: `Image ${i + 1}: ${err}` });
        });
        const skus = new Set<string>();
        v.variants.forEach((row, i) => {
            const key = row.sku.trim().toLowerCase();
            if (key && skus.has(key)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'This SKU is already used above' });
            skus.add(key);
            if (row.sellingPrice > row.mrp) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sellingPrice'], message: 'Price can’t be above the MRP' });
        });
        if (v.variants.filter((row) => row.isDefault).length > 1) {
            ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Only one pack size can be the default' });
        }
        if (v.itemGroupId && !v.subcategoryId) {
            ctx.addIssue({ code: 'custom', path: ['itemGroupId'], message: 'Choose a subcategory before the item group' });
        }
    });

export type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormValues = z.output<typeof productSchema>;

/** Which editor section each field lives in (for the per-section error dots). */
export const FIELD_SECTION: Record<string, SectionId> = {
    name: 'basics',
    brand: 'basics',
    barcode: 'basics',
    description: 'basics',
    highlights: 'basics',
    price: 'pricing',
    mrp: 'pricing',
    gst: 'pricing',
    images: 'media',
    removeBackground: 'media',
    unit: 'inventory',
    stock: 'inventory',
    reorderLevel: 'inventory',
    shelfLife: 'inventory',
    storageType: 'inventory',
    isPerishable: 'organisation',
    categoryId: 'organisation',
    subcategoryId: 'organisation',
    itemGroupId: 'organisation',
    status: 'organisation',
    isAvailable: 'organisation',
    nutrition: 'nutrition',
    variants: 'variants',
};

export type SectionId = 'basics' | 'pricing' | 'media' | 'inventory' | 'organisation' | 'nutrition' | 'variants';

const num = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

export function emptyProductForm(status: ProductStatus = 'active'): ProductFormInput {
    return {
        name: '',
        brand: '',
        barcode: '',
        description: '',
        highlights: '',
        price: undefined,
        mrp: undefined,
        gst: undefined,
        images: [],
        removeBackground: false,
        unit: '',
        stock: 0,
        reorderLevel: 10,
        shelfLife: undefined,
        storageType: '',
        isPerishable: false,
        categoryId: '',
        subcategoryId: '',
        itemGroupId: '',
        status,
        isAvailable: true,
        nutrition: { protein: undefined, carbs: undefined, sugar: undefined, fat: undefined, transFat: undefined, servingSize: '' },
        variants: [],
        isNew: true,
    };
}

export function productToForm(p: AdminProduct): ProductFormInput {
    const images = (p.images?.length ? p.images : p.image ? [p.image] : []).filter(Boolean);
    return {
        name: p.name ?? '',
        brand: p.brand ?? '',
        barcode: p.barcode ?? '',
        description: p.description ?? '',
        highlights: p.highlights ?? '',
        price: num(p.price ?? p.pricing?.sellingPrice),
        mrp: num(p.originalPrice ?? p.pricing?.mrp),
        gst: num(p.gst ?? p.pricing?.gst),
        images,
        removeBackground: false,
        unit: p.unit ?? p.pack?.unit ?? '',
        stock: num(p.stock) ?? 0,
        reorderLevel: num(p.reorderLevel) ?? 10,
        shelfLife: num(p.shelfLife) || undefined,
        storageType: p.storageType ?? '',
        isPerishable: p.isPerishable ?? false,
        categoryId: refId(p.categoryId),
        subcategoryId: refId(p.subcategoryId),
        itemGroupId: refId(p.itemGroupId),
        status: p.status ?? 'active',
        isAvailable: p.isAvailable ?? true,
        nutrition: {
            protein: num(p.nutrition?.protein),
            carbs: num(p.nutrition?.carbs),
            sugar: num(p.nutrition?.sugar),
            fat: num(p.nutrition?.fat),
            transFat: num(p.nutrition?.transFat),
            servingSize: p.nutrition?.servingSize ?? '',
        },
        variants: (p.variants ?? []).map((v) => ({
            sku: v.sku ?? '',
            unit: v.unit ?? '',
            mrp: Number(v.mrp),
            sellingPrice: Number(v.sellingPrice),
            stock: Number(v.stock) || 0,
            isDefault: !!v.isDefault,
            isActive: v.isActive !== false,
        })),
        isNew: false,
    };
}

/** A copy for "Duplicate": new identity (no barcode), no stock, saved as a draft. */
export function duplicateToForm(p: AdminProduct): ProductFormInput {
    // SKUs are unique per pack, so a duplicate starts without the original's pack sizes.
    return { ...productToForm(p), name: `${p.name} (copy)`, barcode: '', stock: 0, status: 'draft', variants: [], isNew: true };
}

type Dirty = Partial<Record<keyof ProductFormValues, unknown>>;

function cleanNutrition(n: ProductFormValues['nutrition']) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n)) {
        if (v !== undefined && v !== '') out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
}

/**
 * Request body for POST /products (no `dirty`) or PUT /products/:id (only the changed fields).
 * PUT updates only what is sent, so untouched fields such as `isAvailable` are never overwritten.
 */
export function toProductPayload(v: ProductFormValues, dirty?: Dirty): Record<string, unknown> {
    const isCreate = !dirty;
    const changed = (key: keyof ProductFormValues) => isCreate || !!dirty?.[key];
    const body: Record<string, unknown> = {};
    const text = (key: 'name' | 'brand' | 'barcode' | 'description' | 'highlights' | 'unit' | 'storageType') => {
        if (!changed(key)) return;
        const value = v[key];
        if (isCreate && !value) return;
        body[key] = value;
    };
    (['name', 'brand', 'barcode', 'description', 'highlights', 'unit', 'storageType'] as const).forEach(text);

    if (changed('price')) body.price = v.price;
    if (changed('mrp')) {
        if (v.mrp !== undefined) body.originalPrice = v.mrp;
        else if (isCreate) body.originalPrice = v.price;
    }
    if (changed('gst')) {
        if (v.gst !== undefined) body.gst = v.gst;
        else if (!isCreate) body.gst = 0;
    }
    if (changed('shelfLife')) {
        if (v.shelfLife !== undefined) body.shelfLife = v.shelfLife;
        else if (!isCreate) body.shelfLife = 0;
    }
    if (changed('reorderLevel') && v.reorderLevel !== undefined) body.reorderLevel = v.reorderLevel;
    if (isCreate) body.stock = v.stock ?? 0;

    if (changed('images')) {
        body.images = v.images;
        body.image = v.images[0] ?? '';
        if (v.images.some((src) => src.startsWith('data:'))) body.removeBackground = v.removeBackground;
    } else if (!isCreate && dirty?.removeBackground && v.images.some((src) => src.startsWith('data:'))) {
        body.removeBackground = v.removeBackground;
    }

    if (changed('categoryId')) body.categoryId = v.categoryId;
    // Clearing a level on edit sends null (the backend stores null); create leaves it out.
    if (changed('subcategoryId') || (!isCreate && dirty?.categoryId)) {
        if (v.subcategoryId) body.subcategoryId = v.subcategoryId;
        else if (!isCreate) body.subcategoryId = null;
    }
    if (changed('itemGroupId') || (!isCreate && (dirty?.categoryId || dirty?.subcategoryId))) {
        if (v.itemGroupId) body.itemGroupId = v.itemGroupId;
        else if (!isCreate) body.itemGroupId = null;
    }
    if (changed('status')) body.status = v.status;
    if (changed('isPerishable')) body.isPerishable = v.isPerishable;
    // isAvailable only when the user touched it (on create the backend default is fine unless turned off).
    if (isCreate ? v.isAvailable === false : !!dirty?.isAvailable) body.isAvailable = v.isAvailable;

    if (changed('nutrition')) {
        const n = cleanNutrition(v.nutrition);
        if (n) body.nutrition = n;
    }
    // Pack sizes go as the whole list (the server replaces it and mirrors the default pack onto
    // the product's own price / unit / stock).
    if (isCreate ? v.variants.length > 0 : !!dirty?.variants) {
        body.variants = v.variants.map((row) => ({
            sku: row.sku.trim(),
            unit: row.unit.trim(),
            mrp: row.mrp,
            sellingPrice: row.sellingPrice,
            stock: row.stock,
            isDefault: row.isDefault,
            isActive: row.isActive,
        }));
    }
    return body;
}

/** Maps backend validation messages ("originalPrice must not be less than 0") to form fields. */
export const SERVER_FIELD_ALIASES: Record<string, keyof ProductFormValues> = {
    name: 'name',
    brand: 'brand',
    barcode: 'barcode',
    description: 'description',
    highlights: 'highlights',
    price: 'price',
    originalPrice: 'mrp',
    gst: 'gst',
    image: 'images',
    images: 'images',
    unit: 'unit',
    stock: 'stock',
    reorderLevel: 'reorderLevel',
    shelfLife: 'shelfLife',
    storageType: 'storageType',
    isPerishable: 'isPerishable',
    categoryId: 'categoryId',
    subcategoryId: 'subcategoryId',
    itemGroupId: 'itemGroupId',
    status: 'status',
    isAvailable: 'isAvailable',
    nutrition: 'nutrition',
};

export function mapServerMessage(message: string): { field?: keyof ProductFormValues; message: string } {
    const m = /^([A-Za-z]+)(?:\.[A-Za-z0-9.]+)?\s/.exec(message.trim());
    const key = m?.[1];
    const field = key ? SERVER_FIELD_ALIASES[key] : undefined;
    if (!field) return { message };
    // Swap the API name for the label the user sees.
    const label: Partial<Record<keyof ProductFormValues, string>> = { mrp: 'MRP', price: 'Selling price', images: 'Image', subcategoryId: 'Subcategory', itemGroupId: 'Item group', categoryId: 'Category' };
    const pretty = label[field] ? message.replace(key!, label[field]!) : message.charAt(0).toUpperCase() + message.slice(1);
    return { field, message: pretty };
}
