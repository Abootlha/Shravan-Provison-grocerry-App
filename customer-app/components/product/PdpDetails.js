/**
 * PDP detail blocks: description text, highlight pairs, nutrition table and info rows.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { space } from '../../constants/theme';
import { InfoRow } from './AccordionSection';
import { unitPriceLabel } from './productUtils';

/** Short lines without trailing punctuation read as sub-headings (legacy CMS format). */
export const DescriptionText = memo(({ text }) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <View key={i} style={styles.gap} />;
        const heading = t.length < 35 && !/[.,;:]$/.test(t);
        return heading ? (
            <Text key={i} variant="bodyStrong" style={styles.subhead}>
                {t}
            </Text>
        ) : (
            <Text key={i} variant="body" color="secondary">
                {t}
            </Text>
        );
    });
});

/** "Key\nValue\nKey\nValue" pairs; long lines stand alone. */
export const HighlightsList = memo(({ text }) => {
    if (!text) return null;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const pairs = [];
    for (let i = 0; i < lines.length; i += 1) {
        if (i + 1 < lines.length && lines[i].length < 40) {
            pairs.push({ key: lines[i], value: lines[i + 1] });
            i += 1;
        } else {
            pairs.push({ key: null, value: lines[i] });
        }
    }
    return pairs.map((p, i) => <InfoRow key={i} label={p.key} value={p.value} last={i === pairs.length - 1} />);
});

const NUTRIENTS = [
    ['protein', 'Protein', 'g'],
    ['carbs', 'Carbohydrates', 'g'],
    ['sugar', 'Sugar', 'g'],
    ['fat', 'Total fat', 'g'],
    ['transFat', 'Trans fat', 'g'],
];

export const hasNutrition = (n) => !!n && NUTRIENTS.some(([k]) => Number(n[k]) > 0);

export const NutritionTable = memo(({ nutrition }) => (
    <View>
        {NUTRIENTS.map(([k, label, u], i) => (
            <InfoRow key={k} label={label} value={`${Number(nutrition[k]) || 0}${u}`} last={i === NUTRIENTS.length - 1} />
        ))}
        <Text variant="caption" color="muted" style={styles.note}>
            Per {nutrition.servingSize || '100g'} serving
        </Text>
    </View>
));

const shelfLifeLabel = (days) => {
    const d = Number(days);
    if (!d) return null;
    if (d >= 60 && d % 30 === 0) return `${d / 30} months`;
    if (d >= 60) return `${Math.round(d / 30)} months`;
    return `${d} ${d === 1 ? 'day' : 'days'}`;
};

export const productInfoRows = (p) =>
    [
        p.brand ? ['Brand', p.brand] : null,
        p.unit ? ['Pack size', p.unit] : null,
        shelfLifeLabel(p.shelfLife) ? ['Shelf life', shelfLifeLabel(p.shelfLife)] : null,
        p.attributes?.storage ? ['Storage', p.attributes.storage] : null,
        p.attributes?.dietary?.length ? ['Dietary', p.attributes.dietary.join(', ')] : null,
    ].filter(Boolean);

const styles = StyleSheet.create({
    gap: { height: space.sm },
    subhead: { marginTop: space.md, marginBottom: space.xs },
    note: { marginTop: space.sm },
});

const STORAGE = {
    Refrigerated: ['Keep refrigerated', 'फ़्रिज में रखें'],
    Frozen: ['Keep frozen', 'फ़्रीज़र में रखें'],
    Ambient: ['Room temperature', 'सामान्य तापमान पर'],
};
const DIET = { Veg: 'शाकाहारी', 'Non-Veg': 'मांसाहारी', Vegan: 'वीगन', 'Gluten Free': 'ग्लूटेन फ़्री', Organic: 'ऑर्गेनिक' };

const shelfLifeHi = (days) => {
    const d = Number(days);
    if (!d) return null;
    if (d >= 60) return `${Math.round(d / 30)} महीने`;
    return `${d} दिन`;
};

/**
 * PDP "Highlights": only facts the product record carries (brand, pack size + unit price, storage,
 * shelf life, diet, fat profile), then any highlight lines the store wrote in the admin. A row
 * whose field is empty is left out; nothing is generic copy.
 */
export const productHighlights = (p, isHi = false) => {
    const L = (en, hi) => (isHi ? hi : en);
    const per = unitPriceLabel(p.price, p.unit, isHi);
    const storage = p.attributes?.storage;
    const fat = p.attributes?.fatProfile;
    const diet = p.attributes?.dietary || [];
    const rows = [
        p.brand ? [L('Brand', 'ब्रांड'), p.brand] : null,
        p.unit ? [L('Pack size', 'पैक साइज़'), per ? `${p.unit} (${per})` : p.unit] : null,
        storage && STORAGE[storage] ? [L('Storage', 'रखरखाव'), STORAGE[storage][isHi ? 1 : 0]] : null,
        Number(p.shelfLife) > 0 ? [L('Shelf life', 'इस्तेमाल की अवधि'), isHi ? shelfLifeHi(p.shelfLife) : shelfLifeLabel(p.shelfLife)] : null,
        diet.length ? [L('Diet', 'आहार'), diet.map((d) => (isHi && DIET[d]) || d).join(', ')] : null,
        fat && fat !== 'NA' ? [L('Fat', 'फ़ैट'), fat] : null,
    ].filter(Boolean);
    // The store's own highlight text ("Key\nValue" pairs or sentences), after the record's facts.
    const lines = String(p.highlights || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
        if (i + 1 < lines.length && lines[i].length < 40 && !/[.!]$/.test(lines[i])) {
            rows.push([lines[i], lines[i + 1]]);
            i += 1;
        } else {
            rows.push([null, lines[i]]);
        }
    }
    return rows;
};
