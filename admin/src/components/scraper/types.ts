/** Shapes returned by GET /admin/scraper/* (backend modules/scraper). */

export type ScrapeStatus = 'queued' | 'scraping' | 'ready' | 'failed' | 'approving' | 'approved' | 'declined';

/** Tabs on the page. "in_progress" = queued + scraping + approving. */
export type ScrapeTab = 'ready' | 'in_progress' | 'failed' | 'approved' | 'declined';

export interface ScrapedImage {
    url: string;
    key?: string;
    sourceUrl?: string;
}

export interface ScrapedItem {
    _id: string;
    sourceUrl: string;
    sourceSite: 'blinkit' | 'bigbasket' | 'zepto' | 'other' | string;
    status: ScrapeStatus;
    batchId?: string;
    error?: string;
    warnings?: string[];
    attempts?: number;
    name?: string;
    brand?: string;
    description?: string;
    highlights?: string;
    price?: number;
    mrp?: number;
    unit?: string;
    barcode?: string;
    stock?: number;
    images: ScrapedImage[];
    /** List responses carry only the cover image plus this count. */
    imageCount?: number;
    imagesInR2?: boolean;
    sourceCategoryPath?: string[];
    shelfLifeDays?: number;
    dietary?: string;
    storage?: string;
    suggestion?: {
        categoryId?: string;
        subcategoryId?: string;
        itemGroupId?: string;
        confidence?: 'high' | 'medium' | 'low';
        matched?: string[];
    };
    categoryId?: string | null;
    subcategoryId?: string | null;
    itemGroupId?: string | null;
    duplicateOf?: string;
    productId?: string;
    declineReason?: string;
    reviewedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ScrapedListResponse {
    items: ScrapedItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type ScrapeCounts = Record<ScrapeTab | 'all', number>;

export interface ScraperStatus {
    r2Configured: boolean;
    browser: 'auto' | 'off';
    maxImages: number;
}

export interface SubmitResult {
    batchId: string;
    queued: number;
    skipped: { url: string; reason: string }[];
}

export interface BulkResult {
    results: { id: string; ok: boolean; message?: string; productId?: string }[];
    approved?: number;
    declined?: number;
}

export interface ScrapedEdits {
    name?: string;
    brand?: string;
    description?: string;
    highlights?: string;
    price?: number;
    mrp?: number;
    unit?: string;
    barcode?: string;
    stock?: number;
    categoryId?: string | null;
    subcategoryId?: string | null;
    itemGroupId?: string | null;
    imageUrls?: string[];
}

export const SITE_LABEL: Record<string, string> = {
    blinkit: 'Blinkit',
    bigbasket: 'BigBasket',
    zepto: 'Zepto',
    other: 'Web',
};
