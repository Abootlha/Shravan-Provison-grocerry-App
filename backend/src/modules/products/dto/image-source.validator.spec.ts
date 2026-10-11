import { isValidImageSource } from './image-source.validator';

describe('isValidImageSource', () => {
  it('accepts http(s) URLs, small data URIs, relative paths and empty', () => {
    expect(isValidImageSource('https://cdn.example.com/a.png')).toBe(true);
    expect(isValidImageSource('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isValidImageSource('/uploads/a.jpg')).toBe(true);
    expect(isValidImageSource('')).toBe(true);
  });

  it('rejects oversized URLs and data URIs', () => {
    expect(isValidImageSource(`https://x.com/${'a'.repeat(3000)}`)).toBe(false);
    expect(
      isValidImageSource(`data:image/png;base64,${'A'.repeat(1_600_000)}`),
    ).toBe(false);
  });

  it('rejects non-image data URIs and other schemes', () => {
    expect(isValidImageSource('data:text/html;base64,PGgxPg==')).toBe(false);
    expect(isValidImageSource('javascript:alert(1)')).toBe(false);
    expect(isValidImageSource('ftp://x.com/a.png')).toBe(false);
  });

  it('accepts short plain icons only when allowed', () => {
    expect(isValidImageSource('leaf')).toBe(false);
    expect(isValidImageSource('leaf', { allowPlainIcon: true })).toBe(true);
  });
});
