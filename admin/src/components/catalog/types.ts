/** Shapes returned by the admin catalogue endpoints (docs/api/admin-api.md). */

export interface Category {
    _id: string;
    name: string;
    nameHi?: string;
    icon?: string;
    image?: string;
    color?: string;
    group?: string;
    groupHi?: string;
    isActive: boolean;
    sortOrder: number;
    description?: string;
    descriptionHi?: string;
    updatedAt?: string;
}

export interface CategoryRef {
    _id: string;
    name: string;
    icon?: string;
    color?: string;
}

export interface Subcategory {
    _id: string;
    name: string;
    nameHi?: string;
    icon?: string;
    image?: string;
    color?: string;
    /** Populated by GET /admin/subcategories; a bare id (or null) if the parent was deleted. */
    parentId: CategoryRef | string | null;
    isActive: boolean;
    sortOrder: number;
    description?: string;
    descriptionHi?: string;
}

export interface SubcategoryRef {
    _id: string;
    name: string;
    parentId?: string;
}

export interface ItemGroup {
    _id: string;
    name: string;
    /** Populated by GET /admin/item-groups. */
    subcategoryId: SubcategoryRef | string | null;
    image?: string;
    description?: string;
    isActive: boolean;
    sortOrder: number;
    tags?: string[];
}

export type BannerTargetType = 'category' | 'product' | 'url';

export interface BannerTarget {
    type: BannerTargetType;
    id?: string;
    url?: string;
}

export interface Banner {
    _id: string;
    title: string;
    titleHi?: string;
    image: string;
    target: BannerTarget;
    sortOrder: number;
    startsAt: string | null;
    endsAt: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProductSummary {
    _id: string;
    name: string;
    nameHi?: string;
    image?: string;
    brand?: string;
    unit?: string;
    status?: string;
}

export interface AdminProductsResponse {
    products: ProductSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** Id of a populated-or-bare reference. */
export function refId(ref: { _id: string } | string | null | undefined): string | undefined {
    if (!ref) return undefined;
    return typeof ref === 'string' ? ref : ref._id;
}

export function refName(ref: { name: string } | string | null | undefined): string | undefined {
    if (!ref || typeof ref === 'string') return undefined;
    return ref.name;
}
