import { describe, it, expect } from 'vitest';
import { validateProductRows, runWithConcurrency } from './productCsv';

const categories = [
    { _id: 'cat1', name: 'Snacks' },
    { _id: 'cat2', name: 'Dairy' },
];

const baseRow = { Name: 'Chips', Price: '20', Stock: '5', Category: 'snacks', Images: 'https://x.test/a.jpg' };

describe('validateProductRows', () => {
    it('accepts a valid row and resolves the category by name', () => {
        const { valid, invalid } = validateProductRows([baseRow], categories);
        expect(invalid).toEqual([]);
        expect(valid[0].data).toMatchObject({ name: 'Chips', price: 20, stock: 5, categoryId: 'cat1' });
    });

    it('rejects bad price, stock, unknown category and non-http images', () => {
        const rows = [
            { ...baseRow, Name: '' },
            { ...baseRow, Price: '0' },
            { ...baseRow, Price: 'abc' },
            { ...baseRow, Stock: '1.5' },
            { ...baseRow, Stock: '-1' },
            { ...baseRow, Category: 'Unknown' },
            { ...baseRow, Category: '' },
            { ...baseRow, Images: 'javascript:alert(1)' },
        ];
        const { valid, invalid } = validateProductRows(rows, categories);
        expect(valid).toEqual([]);
        expect(invalid.map((r) => r.row)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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
});
