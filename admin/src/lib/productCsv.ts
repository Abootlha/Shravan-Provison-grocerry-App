// Products CSV import: column mapping, validation against the catalogue, and batching helpers.
// Category, subcategory and item group are resolved by NAME (or an exact existing id) to ids.
// A name that does not resolve is an error for that row; it is never sent to the API as an id.

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMPORT_CONCURRENCY = 4;

export type ImportFieldKey =
    | 'name'
    | 'brand'
    | 'barcode'
    | 'price'
    | 'mrp'
    | 'stock'
    | 'unit'
    | 'category'
    | 'subcategory'
    | 'itemGroup'
    | 'images'
    | 'gst'
    | 'reorderLevel'
    | 'status'
    | 'description'
    | 'highlights';

export interface ImportField {
    key: ImportFieldKey;
    label: string;
    required: boolean;
    hint: string;
    /** Lower-cased header names that map to this field automatically. */
    aliases: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
    { key: 'name', label: 'Name', required: true, hint: 'Product name as customers see it', aliases: ['name', 'product name', 'product', 'title'] },
    { key: 'price', label: 'Selling price', required: true, hint: 'Rupees, e.g. 45 or 45.50', aliases: ['price', 'selling price', 'sellingprice', 'sp', 'sale price'] },
    { key: 'unit', label: 'Unit', required: true, hint: 'Pack size, e.g. 500 g, 1 L, 6 pcs', aliases: ['unit', 'pack', 'pack size', 'size', 'weight', 'quantity'] },
    { key: 'category', label: 'Category', required: true, hint: 'Existing category name', aliases: ['category', 'category name', 'categoryid'] },
    { key: 'mrp', label: 'MRP', required: false, hint: 'Defaults to the selling price', aliases: ['mrp', 'originalprice', 'original price', 'list price'] },
    { key: 'stock', label: 'Stock', required: false, hint: 'Whole number, defaults to 0', aliases: ['stock', 'qty', 'quantity in stock', 'inventory', 'opening stock'] },
    { key: 'subcategory', label: 'Subcategory', required: false, hint: 'Name of a subcategory in that category', aliases: ['subcategory', 'sub category', 'subcategory name', 'subcategoryid'] },
    { key: 'itemGroup', label: 'Item group', required: false, hint: 'Name of an item group in that subcategory', aliases: ['itemgroup', 'item group', 'group', 'itemgroupid'] },
    { key: 'images', label: 'Image links', required: false, hint: 'https links, separated by |', aliases: ['images', 'image', 'image url', 'imageurl', 'imageurl1', 'image link'] },
    { key: 'brand', label: 'Brand', required: false, hint: '', aliases: ['brand', 'brand name', 'manufacturer'] },
    { key: 'barcode', label: 'Barcode', required: false, hint: 'EAN/UPC digits', aliases: ['barcode', 'ean', 'upc', 'gtin'] },
    { key: 'gst', label: 'GST %', required: false, hint: '0–100', aliases: ['gst', 'gst %', 'tax', 'gst rate'] },
    { key: 'reorderLevel', label: 'Reorder level', required: false, hint: 'Low-stock threshold, defaults to 10', aliases: ['reorderlevel', 'reorder level', 'reorder', 'min stock'] },
    { key: 'status', label: 'Status', required: false, hint: 'active or draft', aliases: ['status', 'state'] },
    { key: 'description', label: 'Description', required: false, hint: '', aliases: ['description', 'details', 'about'] },
    { key: 'highlights', label: 'Highlights', required: false, hint: '', aliases: ['highlights', 'key features', 'features'] },
];

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

const norm = (value: string) => value.trim().toLowerCase().replace(/[_\s]+/g, ' ');
const squash = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

/** Guesses which CSV header feeds each field. Each header is used at most once. */
export function autoMapColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    const used = new Set<string>();
    for (const field of IMPORT_FIELDS) {
        const aliases = field.aliases.map(squash);
        const header = headers.find((h) => !used.has(h) && aliases.includes(squash(h)));
        if (header) {
            mapping[field.key] = header;
            used.add(header);
        }
    }
    return mapping;
}

export interface CatalogCategory {
    _id: string;
    name: string;
}
export interface CatalogSubcategory {
    _id: string;
    name: string;
    parentId: string;
}
export interface CatalogItemGroup {
    _id: string;
    name: string;
    subcategoryId: string;
}
export interface CatalogLookups {
    categories: CatalogCategory[];
    subcategories: CatalogSubcategory[];
    itemGroups: CatalogItemGroup[];
}

export interface ImportRow {
    /** 1-based data row number (header excluded). */
    row: number;
    name: string;
    errors: string[];
    warnings: string[];
    /** Request body for POST /products, present only when there are no errors. */
    data?: Record<string, unknown>;
    status?: 'active' | 'draft';
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function parseNumber(raw: string): number {
    // Accept "₹1,299.00" and "1299".
    return Number(raw.replace(/[₹,\s]/g, ''));
}

type Resolved = { id: string } | { error: string } | null;

function resolveByName<T extends { _id: string; name: string }>(raw: string, candidates: T[], allIds: Set<string>, what: string, scope?: string): Resolved {
    if (!raw) return null;
    if (OBJECT_ID.test(raw)) {
        if (candidates.some((c) => c._id === raw)) return { id: raw };
        return { error: allIds.has(raw) ? `${what} id ${raw} is not in ${scope ?? 'this catalogue'}` : `${what} id ${raw} does not exist` };
    }
    const matches = candidates.filter((c) => norm(c.name) === norm(raw));
    if (matches.length === 1) return { id: matches[0]._id };
    if (matches.length > 1) return { error: `${what} "${raw}" matches ${matches.length} records${scope ? ` in ${scope}` : ''}; use the id instead` };
    return { error: `${what} "${raw}" was not found${scope ? ` in ${scope}` : ''}` };
}

/**
 * Validates parsed CSV rows (Papa.parse with header: true) using the column mapping.
 * Nothing is guessed: a missing unit, unknown category or unmatched subcategory is an error.
 */
export function validateImportRows(rows: Record<string, unknown>[], mapping: ColumnMapping, catalog: CatalogLookups): ImportRow[] {
    const cell = (row: Record<string, unknown>, key: ImportFieldKey) => {
        const header = mapping[key];
        if (!header) return '';
        const value = row[header];
        return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
    };
    const categoryIds = new Set(catalog.categories.map((c) => c._id));
    const subIds = new Set(catalog.subcategories.map((s) => s._id));
    const groupIds = new Set(catalog.itemGroups.map((g) => g._id));
    const seenBarcodes = new Map<string, number>();

    return rows.map((row, index) => {
        const rowNumber = index + 1;
        const errors: string[] = [];
        const warnings: string[] = [];

        const name = cell(row, 'name');
        if (!name) errors.push('Name is required');
        else if (name.length > 200) errors.push('Name is longer than 200 characters');

        const priceRaw = cell(row, 'price');
        const price = parseNumber(priceRaw);
        if (!priceRaw) errors.push('Selling price is required');
        else if (!Number.isFinite(price) || price <= 0) errors.push(`Selling price must be a number above 0 (got "${priceRaw}")`);

        const mrpRaw = cell(row, 'mrp');
        let mrp: number | undefined;
        if (mrpRaw) {
            mrp = parseNumber(mrpRaw);
            if (!Number.isFinite(mrp) || mrp <= 0) errors.push(`MRP must be a number above 0 (got "${mrpRaw}")`);
            else if (Number.isFinite(price) && mrp < price) errors.push(`MRP ₹${mrp} is lower than the selling price ₹${price}`);
        }

        const stockRaw = cell(row, 'stock');
        const stock = stockRaw === '' ? 0 : parseNumber(stockRaw);
        if (!Number.isInteger(stock) || stock < 0) errors.push(`Stock must be a whole number of 0 or more (got "${stockRaw}")`);

        const unit = cell(row, 'unit');
        if (!unit) errors.push('Unit is required (pack size such as 500 g)');
        else if (unit.length > 50) errors.push('Unit is longer than 50 characters');
        else if (/\d{8,}/.test(unit.replace(/\s+/g, ''))) warnings.push(`Unit "${unit}" looks like a barcode`);

        // Category → subcategory → item group, each resolved inside its parent.
        const categoryRaw = cell(row, 'category');
        let categoryId: string | undefined;
        let categoryName = categoryRaw;
        if (!categoryRaw) errors.push('Category is required');
        else {
            const r = resolveByName(categoryRaw, catalog.categories, categoryIds, 'Category');
            if (r && 'id' in r) {
                categoryId = r.id;
                categoryName = catalog.categories.find((c) => c._id === r.id)?.name ?? categoryRaw;
            } else if (r) errors.push(r.error);
        }

        const subRaw = cell(row, 'subcategory');
        let subcategoryId: string | undefined;
        let subName = subRaw;
        if (subRaw && categoryId) {
            const r = resolveByName(subRaw, catalog.subcategories.filter((s) => s.parentId === categoryId), subIds, 'Subcategory', `"${categoryName}"`);
            if (r && 'id' in r) {
                subcategoryId = r.id;
                subName = catalog.subcategories.find((s) => s._id === r.id)?.name ?? subRaw;
            } else if (r) errors.push(r.error);
        } else if (subRaw && !categoryId) {
            errors.push(`Subcategory "${subRaw}" can't be checked until the category is fixed`);
        }

        const groupRaw = cell(row, 'itemGroup');
        let itemGroupId: string | undefined;
        if (groupRaw) {
            if (!subRaw) errors.push(`Item group "${groupRaw}" needs a subcategory`);
            else if (subcategoryId) {
                const r = resolveByName(groupRaw, catalog.itemGroups.filter((g) => g.subcategoryId === subcategoryId), groupIds, 'Item group', `"${subName}"`);
                if (r && 'id' in r) itemGroupId = r.id;
                else if (r) errors.push(r.error);
            }
        }

        const imagesRaw = cell(row, 'images');
        const images = imagesRaw
            .split(/[|\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
        const badImages = images.filter((img) => !isHttpUrl(img));
        if (badImages.length) errors.push(`Image links must start with https:// (${badImages.join(', ')})`);
        if (images.length > 8) errors.push(`At most 8 images per product (got ${images.length})`);

        const brand = cell(row, 'brand');
        if (brand.length > 100) errors.push('Brand is longer than 100 characters');

        const barcode = cell(row, 'barcode');
        if (barcode) {
            if (barcode.length > 32) errors.push('Barcode is longer than 32 characters');
            const first = seenBarcodes.get(barcode);
            if (first) errors.push(`Barcode ${barcode} is also on row ${first}`);
            else seenBarcodes.set(barcode, rowNumber);
        }

        const gstRaw = cell(row, 'gst').replace('%', '');
        let gst: number | undefined;
        if (gstRaw) {
            gst = parseNumber(gstRaw);
            if (!Number.isFinite(gst) || gst < 0 || gst > 100) errors.push(`GST must be between 0 and 100 (got "${gstRaw}")`);
        }

        const reorderRaw = cell(row, 'reorderLevel');
        let reorderLevel: number | undefined;
        if (reorderRaw) {
            reorderLevel = parseNumber(reorderRaw);
            if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 100_000) errors.push(`Reorder level must be a whole number 0–100000 (got "${reorderRaw}")`);
        }

        const description = cell(row, 'description');
        const highlights = cell(row, 'highlights');
        if (description.length > 5000) errors.push('Description is longer than 5000 characters');
        if (highlights.length > 5000) errors.push('Highlights are longer than 5000 characters');

        // Status: explicit column wins. Otherwise a row with no image is imported as a draft
        // (active products need an image) and that is shown in the preview, not hidden.
        const statusRaw = cell(row, 'status').toLowerCase();
        let status: 'active' | 'draft';
        if (statusRaw) {
            if (statusRaw !== 'active' && statusRaw !== 'draft') {
                errors.push(`Status must be "active" or "draft" (got "${statusRaw}")`);
                status = 'draft';
            } else status = statusRaw;
            if (status === 'active' && images.length === 0) errors.push('Active products need an image link; set status to draft or add an image');
        } else if (images.length === 0) {
            status = 'draft';
            warnings.push('No image, so it will be imported as a draft');
        } else status = 'active';

        const result: ImportRow = { row: rowNumber, name: name || '(no name)', errors, warnings, status };
        if (errors.length) return result;

        const data: Record<string, unknown> = {
            name,
            price,
            originalPrice: mrp ?? price,
            unit,
            stock,
            categoryId,
            status,
        };
        if (subcategoryId) data.subcategoryId = subcategoryId;
        if (itemGroupId) data.itemGroupId = itemGroupId;
        if (brand) data.brand = brand;
        if (barcode) data.barcode = barcode;
        if (gst !== undefined) data.gst = gst;
        if (reorderLevel !== undefined) data.reorderLevel = reorderLevel;
        if (description) data.description = description;
        if (highlights) data.highlights = highlights;
        if (images.length) {
            data.images = images;
            data.image = images[0];
        }
        result.data = data;
        return result;
    });
}

const TEMPLATE_HEADERS = ['Name', 'Brand', 'Barcode', 'Price', 'MRP', 'Stock', 'Unit', 'Category', 'Subcategory', 'ItemGroup', 'Images', 'GST', 'ReorderLevel', 'Status', 'Description', 'Highlights'];

function csvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Template with the real column names and one example row using a real category name. */
export function buildTemplateCsv(exampleCategory = 'Your category name', exampleSubcategory = ''): string {
    const example = [
        'Example Toor Dal',
        'Example Brand',
        '',
        '145',
        '160',
        '25',
        '1 kg',
        exampleCategory,
        exampleSubcategory,
        '',
        'https://example.com/toor-dal.jpg',
        '5',
        '10',
        'draft',
        'Unpolished toor dal',
        '',
    ];
    return `${TEMPLATE_HEADERS.join(',')}\n${example.map(csvCell).join(',')}\n`;
}

/** Runs `worker` over `items` with at most `limit` calls in flight. Stops starting new work once `signal` aborts. */
export async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
    signal?: AbortSignal,
): Promise<void> {
    let next = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length && !signal?.aborted) {
            const index = next++;
            await worker(items[index], index);
        }
    });
    await Promise.all(lanes);
}
