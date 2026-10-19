/**
 * SearchSuggestions — up to 6 suggestions while typing, drawn from the real catalogue (product,
 * category and subcategory names), with the part that matched in bold. Hindi/Hinglish and small
 * typos match through the same expansion the search uses ("doodh" suggests "Amul Taaza … Milk").
 *
 *   category rows   "Dairy, Bread & Eggs" + "Category" caption → opens the category
 *   product rows    the product name → runs that search
 *
 * Plain list, no inner scroll (Baymard autocomplete); it sits above the results grid.
 */
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableHighlight, Text } from '../../components/ui';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { expandQuery, normalizeText } from './searchSynonyms';

const MAX = 6;
const MAX_CATEGORIES = 2;

/** Splits `label` around the first occurrence of any needle (case-insensitive). */
export function splitMatch(label, needles) {
    const lower = String(label || '').toLowerCase();
    let best = null;
    needles.forEach((n) => {
        if (!n) return;
        const i = lower.indexOf(n);
        if (i >= 0 && (!best || i < best.i || (i === best.i && n.length > best.n))) best = { i, n: n.length };
    });
    if (!best) return [label, '', ''];
    return [label.slice(0, best.i), label.slice(best.i, best.i + best.n), label.slice(best.i + best.n)];
}

const wordStart = (text, needle) => text.startsWith(needle) || text.includes(` ${needle}`);

export function buildSuggestions(query, { products = [], categories = [], vocabulary, isHi }) {
    const q = normalizeText(query);
    if (q.length < 2) return [];
    const expanded = expandQuery(query, vocabulary);
    const needles = [...new Set([q, ...normalizeText(expanded.text).split(' ').filter((w) => w.length >= 3)])];
    const nameOf = (x) => (isHi && (x.nameHi || x.translatedName)) || x.name || '';

    const cats = categories
        .filter((c) => needles.some((n) => normalizeText(`${c.name} ${c.nameHi || ''}`).includes(n)))
        .slice(0, MAX_CATEGORIES)
        .map((c) => ({ kind: 'category', key: `c-${c._id || c.id}`, label: nameOf(c), item: c }));

    const scored = [];
    const seen = new Set();
    products.forEach((p) => {
        const label = nameOf(p);
        const text = normalizeText(`${p.name} ${p.nameHi || ''}`);
        const hit = needles.find((n) => text.includes(n));
        if (!hit || seen.has(label)) return;
        seen.add(label);
        scored.push({ p, label, start: wordStart(text, hit) ? 0 : 1 });
    });
    scored.sort((a, b) => a.start - b.start || (Number(b.p.soldCount) || 0) - (Number(a.p.soldCount) || 0));
    const prods = scored.slice(0, MAX - cats.length).map(({ p, label }) => ({ kind: 'product', key: `p-${p._id || p.id}`, label, item: p }));
    return { rows: [...cats, ...prods], needles };
}

const Row = memo(function Row({ row, needles, onPress, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const [a, b, c] = splitMatch(row.label, needles);
    const isCat = row.kind === 'category';
    return (
        <PressableHighlight onPress={() => onPress(row)} style={styles.row} accessibilityRole="button" accessibilityLabel={isCat ? `${row.label}, ${isHi ? 'श्रेणी' : 'category'}` : row.label}>
            <MaterialCommunityIcons name={isCat ? 'shape-outline' : 'magnify'} size={18} color={colors.inkMuted} />
            <View style={styles.texts}>
                <Text variant="body" color="secondary" numberOfLines={1}>
                    {a}
                    <Text variant="bodyStrong" color="ink">
                        {b}
                    </Text>
                    {c}
                </Text>
                {isCat ? (
                    <Text variant="caption" color="muted">
                        {isHi ? 'श्रेणी' : 'Category'}
                    </Text>
                ) : null}
            </View>
            <MaterialCommunityIcons name={isCat ? 'chevron-right' : 'arrow-top-left'} size={18} color={colors.inkMuted} />
        </PressableHighlight>
    );
});

function SearchSuggestions({ query, products, categories, vocabulary, isHi, onTerm, onCategory }) {
    const styles = useStyles();
    const { rows = [], needles = [] } = useMemo(
        () => buildSuggestions(query, { products, categories, vocabulary, isHi }) || {},
        [query, products, categories, vocabulary, isHi],
    );
    if (!rows.length) return null;
    const onPress = (row) => (row.kind === 'category' ? onCategory(row.item) : onTerm(row.label));
    return (
        <View style={styles.wrap} accessibilityRole="list" accessibilityLabel={isHi ? 'सुझाव' : 'Suggestions'}>
            {rows.map((row) => (
                <Row key={row.key} row={row} needles={needles} onPress={onPress} isHi={isHi} />
            ))}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    wrap: {
        marginTop: space.sm,
        backgroundColor: t.colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm },
    texts: { flex: 1 },
}));

export default memo(SearchSuggestions);
