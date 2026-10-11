/**
 * PDP detail blocks: description text, highlight pairs, nutrition table, info rows and the
 * trust strip. Pure presentational pieces used by ProductDetailScreen.
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '../ui';
import { radii, space } from '../../constants/theme';
import { useTheme } from '../../theme';
import { InfoRow } from './AccordionSection';

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

const TRUST = [
    ['leaf', 'Fresh & quality assured', 'ताज़ा और गुणवत्ता की गारंटी'],
    ['clock-outline', 'Delivered in 10 minutes', '10 मिनट में डिलीवरी'],
    ['refresh', 'Easy returns & refunds', 'आसान रिटर्न और रिफ़ंड'],
];

export const TrustStrip = memo(function TrustStrip({ isHi }) {
    const { colors } = useTheme();
    return (
    <View style={styles.trust}>
        {TRUST.map(([icon, en, hi]) => (
            <View key={icon} style={[styles.trustTile, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <MaterialCommunityIcons name={icon} size={20} color={colors.inkSecondary} />
                <Text variant="caption" color="secondary" align="center" numberOfLines={2}>
                    {isHi ? hi : en}
                </Text>
            </View>
        ))}
    </View>
    );
});

const styles = StyleSheet.create({
    gap: { height: space.sm },
    subhead: { marginTop: space.md, marginBottom: space.xs },
    note: { marginTop: space.sm },
    trust: { flexDirection: 'row', gap: space.sm },
    trustTile: {
        flex: 1,
        borderRadius: radii.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        paddingVertical: space.md,
        paddingHorizontal: space.sm,
        alignItems: 'center',
        gap: space.xs + 2,
    },
});
