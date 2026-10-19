/**
 * Hindi / Hinglish search synonyms for GET /products?search=.
 *
 * Shoppers type "doodh", "aloo" or "दूध"; the catalogue says "Milk", "Potato". Mongo's $text
 * search ORs the words it is given, so the query is expanded with the English word the catalogue
 * uses (the original words stay in, so "Aloo Bhujia" still matches "aloo").
 *
 * The customer app applies the same table on the client (customer-app/screens/search/
 * searchSynonyms.js, which also corrects small typos); keep the two lists in step.
 */

export const SEARCH_SYNONYMS: Record<string, string> = {
  // dairy
  doodh: 'milk',
  dudh: 'milk',
  दूध: 'milk',
  dahi: 'curd',
  दही: 'curd',
  curd: 'dahi',
  makhan: 'butter',
  makkhan: 'butter',
  मक्खन: 'butter',
  panir: 'paneer',
  पनीर: 'paneer',
  ghi: 'ghee',
  घी: 'ghee',
  anda: 'eggs',
  ande: 'eggs',
  अंडा: 'eggs',
  अंडे: 'eggs',
  // staples
  aata: 'atta',
  ata: 'atta',
  आटा: 'atta',
  chawal: 'rice',
  chaawal: 'rice',
  चावल: 'rice',
  daal: 'dal',
  दाल: 'dal',
  namak: 'salt',
  नमक: 'salt',
  cheeni: 'sugar',
  chini: 'sugar',
  shakkar: 'sugar',
  चीनी: 'sugar',
  tel: 'oil',
  तेल: 'oil',
  बेसन: 'besan',
  मसाला: 'masala',
  मिर्च: 'chilli',
  // produce
  sabzi: 'vegetables',
  sabji: 'vegetables',
  subzi: 'vegetables',
  सब्ज़ी: 'vegetables',
  सब्जी: 'vegetables',
  aloo: 'potato',
  alu: 'potato',
  आलू: 'potato',
  pyaaz: 'onion',
  pyaz: 'onion',
  pyaj: 'onion',
  प्याज़: 'onion',
  प्याज: 'onion',
  tamatar: 'tomato',
  टमाटर: 'tomato',
  भिंडी: 'bhindi',
  okra: 'bhindi',
  dhaniya: 'coriander',
  dhania: 'coriander',
  धनिया: 'coriander',
  kela: 'banana',
  केला: 'banana',
  seb: 'apple',
  सेब: 'apple',
  aam: 'mango',
  आम: 'mango',
  phal: 'fruits',
  फल: 'fruits',
  // packaged
  biskut: 'biscuits',
  biskit: 'biscuits',
  biscuit: 'biscuits',
  बिस्कुट: 'biscuits',
  chai: 'tea',
  चाय: 'tea',
  patti: 'tea',
  kofi: 'coffee',
  कॉफ़ी: 'coffee',
  कॉफी: 'coffee',
  नमकीन: 'namkeen',
  चिप्स: 'chips',
  noodle: 'noodles',
  नूडल्स: 'noodles',
  roti: 'atta',
  pav: 'bread',
  ब्रेड: 'bread',
  sabun: 'soap',
  साबुन: 'soap',
  manjan: 'toothpaste',
  मंजन: 'toothpaste',
  जूस: 'juice',
  sharbat: 'juice',
};

/** Multi-word phrases, checked before single words. */
export const SEARCH_PHRASES: Record<string, string> = {
  'hari mirch': 'green chilli',
  'हरी मिर्च': 'green chilli',
  'cold drink': 'soft drink',
  'double roti': 'bread',
  'sarson tel': 'mustard oil',
  'sarson ka tel': 'mustard oil',
};

/** Max words sent to $text, so a pasted paragraph can't build a huge query. */
const MAX_TERMS = 16;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * "doodh" → "doodh milk"; "hari mirch" → "hari mirch green chilli"; "Amul milk" → "amul milk".
 * Returns the words to hand to $text (original words first, then synonyms, de-duplicated).
 */
export function expandSearchTerms(search: string): string {
  const text = normalize(String(search || ''));
  if (!text) return '';
  const words = text.split(' ');
  const extra: string[] = [];
  Object.entries(SEARCH_PHRASES).forEach(([phrase, canon]) => {
    if (` ${text} `.includes(` ${phrase} `)) extra.push(...canon.split(' '));
  });
  words.forEach((w) => {
    const syn = SEARCH_SYNONYMS[w];
    if (syn) extra.push(...syn.split(' '));
  });
  return [...new Set([...words, ...extra])].slice(0, MAX_TERMS).join(' ');
}
