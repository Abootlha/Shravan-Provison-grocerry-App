/** Shapes returned by the admin products API (docs/api/admin-api.md, "Products and inventory"). */

export type ProductStatus = 'draft' | 'active' | 'archived';
export type StockState = 'ok' | 'low' | 'out';
export type ProductIssue = 'missing_price' | 'no_image' | 'missing_unit' | 'unit_looks_like_barcode';

export interface RefName {
    _id: string;
    name: string;
}

export interface Nutrition {
    protein?: number;
    carbs?: number;
    sugar?: number;
    fat?: number;
    transFat?: number;
    servingSize?: string;
}

export interface ProductVariant {
    sku: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    stock: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
}

export interface AdminProduct {
    _id: string;
    name: string;
    nameHi?: string;
    brand?: string;
    barcode?: string;
    sku?: string;
    categoryId: RefName | string | null;
    subcategoryId?: RefName | string | null;
    itemGroupId?: RefName | string | null;
    price?: number;
    originalPrice?: number;
    pricing?: { mrp?: number; sellingPrice?: number; gst?: number };
    gst?: number;
    unit?: string;
    pack?: { unit?: string; weight?: string };
    stock: number;
    reorderLevel?: number;
    image?: string;
    images?: string[];
    isAvailable?: boolean;
    status?: ProductStatus;
    soldCount?: number;
    description?: string;
    highlights?: string;
    shelfLife?: number;
    storageType?: string;
    nutrition?: Nutrition;
    variants?: ProductVariant[];
    createdAt?: string;
    updatedAt?: string;
    stockState?: StockState;
    issues?: ProductIssue[];
}

export interface ProductsResponse {
    products: AdminProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ProductCounts {
    all: number;
    active: number;
    draft: number;
    archived: number;
    needsAttention: number;
    lowStock: number;
    outOfStock: number;
}

export interface Category {
    _id: string;
    name: string;
    isActive?: boolean;
}

export interface Subcategory {
    _id: string;
    name: string;
    isActive?: boolean;
    parentId: RefName | string | null;
}

export interface ItemGroup {
    _id: string;
    name: string;
    isActive?: boolean;
    subcategoryId: (RefName & { parentId?: string }) | string | null;
}

export interface StockAdjustment {
    _id: string;
    productId: string;
    delta: number;
    previousStock: number;
    newStock: number;
    reason: StockReason;
    note?: string;
    actorId?: { _id: string; name?: string; role?: string } | string | null;
    actorRole?: string;
    createdAt: string;
}

export type StockReason = 'restock' | 'damage' | 'correction' | 'return' | 'other';

export const STOCK_REASONS: { value: StockReason; label: string; hint: string }[] = [
    { value: 'restock', label: 'Restock', hint: 'New stock arrived' },
    { value: 'return', label: 'Customer return', hint: 'Returned and resellable' },
    { value: 'damage', label: 'Damaged or expired', hint: 'Removed from the shelf' },
    { value: 'correction', label: 'Count correction', hint: 'Shelf count differs from the system' },
    { value: 'other', label: 'Other', hint: 'Explain in the note' },
];

export const ISSUE_LABEL: Record<ProductIssue, string> = {
    missing_price: 'No price',
    no_image: 'No image',
    missing_unit: 'No unit',
    unit_looks_like_barcode: 'Unit looks like a barcode',
};

/** The id of a populated ref or a raw id string. */
export function refId(value: RefName | string | null | undefined): string {
    if (!value) return '';
    return typeof value === 'string' ? value : value._id;
}

export function refName(value: RefName | string | null | undefined): string {
    if (!value || typeof value === 'string') return '';
    return value.name;
}

export function productImage(p: Pick<AdminProduct, 'image' | 'images'>): string {
    return p.image || p.images?.find(Boolean) || '';
}

export function productMrp(p: AdminProduct): number | undefined {
    return p.originalPrice ?? p.pricing?.mrp;
}

export function productPrice(p: AdminProduct): number | undefined {
    return p.price ?? p.pricing?.sellingPrice;
}

export function productUnit(p: AdminProduct): string {
    return p.unit || p.pack?.unit || '';
}

export function productStatus(p: AdminProduct): ProductStatus {
    return p.status ?? 'active';
}
