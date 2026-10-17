import { describe, expect, it } from 'vitest';
import { parseLinks } from './api';

describe('parseLinks', () => {
    it('splits on new lines, spaces and commas, de-duplicates, and reports non-links', () => {
        const { urls, invalid } = parseLinks(
            'https://blinkit.com/prn/a/prid/1\nhttps://blinkit.com/prn/a/prid/1, https://shop.test/p/2  hello ftp://x.test/file',
        );
        expect(urls).toEqual(['https://blinkit.com/prn/a/prid/1', 'https://shop.test/p/2']);
        expect(invalid).toEqual(['hello', 'ftp://x.test/file']);
    });

    it('returns nothing for blank input', () => {
        expect(parseLinks('  \n ')).toEqual({ urls: [], invalid: [] });
    });
});
