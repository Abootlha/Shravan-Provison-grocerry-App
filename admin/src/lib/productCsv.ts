// Validation and batching helpers for the products CSV bulk import.

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMPORT_CONCURRENCY = 5;

export interface CsvCategory {
    _id: string;
    name: string;
}

export interface ValidProductRow {
    /** 1-based data row number (header excluded), as shown to the user. */
    row: number;
    data: Record<string, unknown>;
}

export interface RowError {
    row: number;
    name: string;
    errors: string[];
}

export interface ValidationResult {
    valid: ValidProductRow[];
    invalid: RowError[];
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validates parsed CSV rows (Papa.parse with header: true) against the template columns.
 * Category is matched by name (case-insensitive) or exact id; there is no fallback category.
 */
export function validateProductRows(rows: Record<string, unknown>[], categories: CsvCategory[]): ValidationResult {
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c._id]));
    const byId = new Set(categories.map((c) => c._id));

    const valid: ValidProductRow[] = [];
    const invalid: RowError[] = [];

    rows.forEach((row, index) => {
        const rowNumber = index + 1;
        const errors: string[] = [];

        const name = str(row.Name);
        if (!name) errors.push('Name is required');

        const priceRaw = str(row.Price);
        const price = Number(priceRaw);
        if (!priceRaw || !Number.isFinite(price) || price <= 0) {
            errors.push(`Price must be a number greater than 0 (got "${priceRaw}")`);
        }

        const originalPriceRaw = str(row.OriginalPrice);
        let originalPrice = price;
        if (originalPriceRaw) {
            originalPrice = Number(originalPriceRaw);
            if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
                errors.push(`OriginalPrice must be a number greater than 0 (got "${originalPriceRaw}")`);
            }
        }

        const stockRaw = str(row.Stock);
        const stock = stockRaw === '' ? 0 : Number(stockRaw);
        if (!Number.isInteger(stock) || stock < 0) {
            errors.push(`Stock must be a whole number >= 0 (got "${stockRaw}")`);
        }

        const categoryRaw = str(row.Category);
        const categoryId = byId.has(categoryRaw) ? categoryRaw : byName.get(categoryRaw.toLowerCase());
        if (!categoryRaw) {
            errors.push('Category is required');
        } else if (!categoryId) {
            errors.push(`Category "${categoryRaw}" does not match any existing category`);
        }

        const imagesField = str(row.Images);
        const images = (imagesField
            ? imagesField.split('|')
            : [row.ImageURL1, row.ImageURL2, row.ImageURL3, row.ImageURL4].map(str)
        )
            .map((img) => str(img))
            .filter(Boolean);
        const badImages = images.filter((img) => !isHttpUrl(img));
        if (badImages.length > 0) {
            errors.push(`Image URLs must start with http:// or https:// (${badImages.join(', ')})`);
        }

        if (errors.length > 0) {
            invalid.push({ row: rowNumber, name: name || '(no name)', errors });
            return;
        }

        const data: Record<string, unknown> = {
            name,
            brand: str(row.Brand),
            price,
            originalPrice,
            stock,
            unit: str(row.Unit) || '1pc',
            categoryId,
            subcategoryId: str(row.Subcategory) || null,
            itemGroupId: str(row.ItemGroup) || null,
            description: str(row.Description),
            highlights: str(row.Highlights),
            images,
            image: images[0] || '',
            isAvailable: true,
        };
        const barcode = str(row.Barcode);
        if (barcode) data.barcode = barcode;

        valid.push({ row: rowNumber, data });
    });

    return { valid, invalid };
}

/** Runs `worker` over `items` with at most `limit` calls in flight. */
export async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
    let next = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            await worker(items[index], index);
        }
    });
    await Promise.all(lanes);
}
