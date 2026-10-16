/**
 * Suggests where a scraped product belongs in the store's own taxonomy
 * (category > subcategory > item group) by matching words from the source
 * site's category path and the product name against the store's names.
 *
 * Pure function: the service loads the taxonomy once per job and passes it in.
 */

export interface TaxonomyNode {
  _id: string;
  name: string;
  /** Subcategory: category id. Item group: subcategory id. */
  parentId?: string;
  tags?: string[];
  isActive?: boolean;
}

export interface Taxonomy {
  categories: TaxonomyNode[];
  subcategories: TaxonomyNode[];
  itemGroups: TaxonomyNode[];
}

export interface CategorySignals {
  /** Source taxonomy, broadest first. */
  categoryPath: string[];
  name: string;
  brand?: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface CategorySuggestion {
  categoryId: string;
  subcategoryId?: string;
  itemGroupId?: string;
  confidence: Confidence;
  score: number;
  /** Store names that matched, for the admin preview ("Biscuits > Cookies"). */
  matched: string[];
}

const STOPWORDS = new Set([
  'and',
  'the',
  'of',
  'for',
  'with',
  'in',
  'a',
  'an',
  'to',
  'more',
  'other',
  'others',
  'items',
  'item',
  'products',
  'product',
  'pack',
  'packs',
  'family',
  'combo',
]);

/** Lowercase word stems: "Cookies & Biscuits" -> ["cooky", "biscuit"]. */
export function tokens(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/&/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

/** Crude plural folding; it only has to map singular and plural to the same key. */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss'))
    w = w.slice(0, -1);
  // "cookie" and "cookies" -> "cooky", like "berry" / "berries".
  if (w.length > 3 && w.endsWith('ie')) w = `${w.slice(0, -2)}y`;
  return w;
}

/**
 * Share of the node's words found in the signal (0..1). A store category
 * "Biscuits" fully matches a source path "Bakery & Biscuits".
 */
function overlap(nodeTokens: string[], signal: Set<string>): number {
  if (!nodeTokens.length) return 0;
  let hits = 0;
  for (const t of nodeTokens) if (signal.has(t)) hits++;
  return hits / nodeTokens.length;
}

interface Weighted {
  set: Set<string>;
  weight: number;
}

function nodeScore(node: TaxonomyNode, signals: Weighted[]): number {
  const nameTokens = tokens(node.name);
  const tagTokens = (node.tags ?? []).flatMap(tokens);
  let score = 0;
  for (const s of signals) {
    const byName = overlap(nameTokens, s.set);
    const byTag = tagTokens.length ? overlap(tagTokens, s.set) * 0.6 : 0;
    score += Math.max(byName, byTag) * s.weight;
  }
  return score;
}

export function suggestCategory(
  taxonomy: Taxonomy,
  signals: CategorySignals,
): CategorySuggestion | null {
  const path = signals.categoryPath.filter(Boolean);
  // The most specific source category says the most; the name helps when
  // the source has no taxonomy (generic JSON-LD pages).
  const weighted: Weighted[] = [
    ...path.map((p, i) => ({
      set: new Set(tokens(p)),
      weight: 1.5 + i * 0.75,
    })),
    { set: new Set(tokens(signals.name)), weight: path.length ? 1 : 2 },
  ].filter((w) => w.set.size > 0);
  if (!weighted.length) return null;

  const active = (n: TaxonomyNode) => n.isActive !== false;
  const categories = taxonomy.categories.filter(active);
  const subcategories = taxonomy.subcategories.filter(active);
  const itemGroups = taxonomy.itemGroups.filter(active);

  const catScore = new Map(
    categories.map((c) => [c._id, nodeScore(c, weighted)]),
  );
  const subScore = new Map(
    subcategories.map((s) => [s._id, nodeScore(s, weighted)]),
  );

  let best: CategorySuggestion | null = null;
  const consider = (candidate: CategorySuggestion) => {
    if (candidate.score <= 0) return;
    if (!best || candidate.score > best.score) best = candidate;
  };

  const categoryById = new Map(categories.map((c) => [c._id, c]));
  const subById = new Map(subcategories.map((s) => [s._id, s]));

  // Every level adds its own weighted score, so a matching deeper level
  // (item group) always beats stopping at its parent.
  const W_CATEGORY = 0.6;
  const W_SUBCATEGORY = 1;
  const W_ITEM_GROUP = 1.2;

  for (const c of categories) {
    consider({
      categoryId: c._id,
      score: catScore.get(c._id)! * W_CATEGORY,
      confidence: 'low',
      matched: [c.name],
    });
  }
  for (const s of subcategories) {
    const c = s.parentId ? categoryById.get(s.parentId) : undefined;
    if (!c) continue;
    const own = subScore.get(s._id)!;
    if (own <= 0) continue;
    consider({
      categoryId: c._id,
      subcategoryId: s._id,
      score: own * W_SUBCATEGORY + catScore.get(c._id)! * W_CATEGORY,
      confidence: 'low',
      matched: [c.name, s.name],
    });
  }
  for (const g of itemGroups) {
    const s = g.parentId ? subById.get(g.parentId) : undefined;
    const c = s?.parentId ? categoryById.get(s.parentId) : undefined;
    if (!s || !c) continue;
    const own = nodeScore(g, weighted);
    if (own <= 0) continue;
    consider({
      categoryId: c._id,
      subcategoryId: s._id,
      itemGroupId: g._id,
      score:
        own * W_ITEM_GROUP +
        subScore.get(s._id)! * W_SUBCATEGORY +
        catScore.get(c._id)! * W_CATEGORY,
      confidence: 'low',
      matched: [c.name, s.name, g.name],
    });
  }

  if (!best) return null;
  const result = best as CategorySuggestion;
  result.score = Math.round(result.score * 100) / 100;

  // Confidence: how completely the deepest chosen name appears in the
  // source's own category path (a site category is a stronger signal than
  // words in the product name).
  const deepest =
    (result.itemGroupId &&
      itemGroups.find((g) => g._id === result.itemGroupId)) ||
    (result.subcategoryId && subById.get(result.subcategoryId)) ||
    categoryById.get(result.categoryId)!;
  const nameTokens = tokens(deepest.name);
  const pathSets = path.map((p) => new Set(tokens(p)));
  const pathMatch = Math.max(0, ...pathSets.map((s) => overlap(nameTokens, s)));
  const nameMatch = overlap(nameTokens, new Set(tokens(signals.name)));
  result.confidence =
    pathMatch >= 0.99
      ? 'high'
      : pathMatch >= 0.5 || nameMatch >= 0.99
        ? 'medium'
        : 'low';
  return result;
}
