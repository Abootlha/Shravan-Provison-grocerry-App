/**
 * Idle search view: recent searches (chips, clear all), suggested terms with their own glyphs,
 * and popular categories on neutral image wells (photo, else the category's 3D icon).
 *
 * Motion: the sections rise in on first paint; recent and trending chips stagger in one by one
 * (layout.enterAt). Removing a recent term (its × or "Clear all") fades it out while the chips
 * after it slide over (layout.list), and the sections below glide up when the block empties.
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedListItem, Chip, Icon3D, icon3dFor, PressableScale, SectionHeader, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { useTheme, makeStyles } from '../../theme';
import { press, layout } from '../../theme/motion';

// Suggested starting terms (a fixed list, labelled as suggestions — not a live trend feed).
// [English term, Hindi term, glyph]
const SUGGESTED = [
    ['Organic fruits', 'ऑर्गेनिक फल', 'fruit-cherries'],
    ['Dairy products', 'डेयरी उत्पाद', 'cup-outline'],
    ['Snacks', 'स्नैक्स', 'cookie-outline'],
    ['Cold drinks', 'कोल्ड ड्रिंक्स', 'bottle-soda-classic-outline'],
    ['Cleaning products', 'सफ़ाई का सामान', 'spray-bottle'],
];

const HistoryIcon = ({ color, size }) => <MaterialCommunityIcons name="history" color={color} size={size} />;
const CloseIcon = ({ color, size }) => <MaterialCommunityIcons name="close" color={color} size={size - 2} />;

export const CategoryTile = memo(function CategoryTile({ category, onPress, isHi, style }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const name = (isHi && (category.nameHi || category.translatedName)) || category.name;
    return (
        <PressableScale onPress={onPress} scaleTo={press.scale} style={[styles.tile, style]} accessibilityLabel={name}>
            <View style={styles.tileWell}>
                {category.image ? (
                    <Image source={{ uri: category.image }} style={styles.tileImg} contentFit="cover" transition={150} />
                ) : icon3dFor(category) ? (
                    <Icon3D name={icon3dFor(category)} size={40} />
                ) : (
                    <MaterialCommunityIcons name={category.icon || 'basket-outline'} size={28} color={colors.inkSecondary} />
                )}
            </View>
            <Text variant="caption" weight="semibold" align="center" numberOfLines={2} style={styles.tileName}>
                {name}
            </Text>
        </PressableScale>
    );
});

const TrendingTerm = memo(function TrendingTerm({ label, icon, onPress }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
    <PressableScale onPress={onPress} scaleTo={press.scale} haptic="selection" style={styles.trend} accessibilityRole="button" accessibilityLabel={label}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.inkSecondary} />
        <Text variant="label" numberOfLines={1}>
            {label}
        </Text>
    </PressableScale>
    );
});

/** A recent term: the chip runs the search; the × on its right end removes it. */
const RecentChip = memo(function RecentChip({ term, selected, onTerm, onRemove, isHi }) {
    const styles = useStyles();
    return (
        <View>
            <Chip size="sm" label={term} selected={selected} leftIcon={HistoryIcon} rightIcon={CloseIcon} onPress={() => onTerm(term)} />
            <PressableScale
                onPress={() => onRemove(term)}
                scaleTo={press.deep}
                haptic="light"
                style={styles.remove}
                hitSlop={{ top: 6, bottom: 6, right: 4 }}
                accessibilityLabel={isHi ? `${term} हटाएँ` : `Remove ${term} from recent searches`}
            />
        </View>
    );
});

function SearchIdle({ recent, onClearRecent, onRemoveRecent, onTerm, categories, onCategory, isHi, bottomPad, onScroll }) {
    const styles = useStyles();
    return (
        <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[styles.wrap, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
        >
            {recent.length > 0 ? (
                <Animated.View key="recent" layout={layout.list} exiting={layout.exit}>
                    <AnimatedListItem index={1} style={styles.section}>
                        <SectionHeader
                            title={isHi ? 'हाल की खोजें' : 'Recent searches'}
                            actionLabel={isHi ? 'सब हटाएँ' : 'Clear all'}
                            onActionPress={onClearRecent}
                        />
                        <View style={styles.chips}>
                            {recent.map((term, i) => (
                                <Animated.View key={term} entering={layout.enterAt(i + 1)} exiting={layout.exit} layout={layout.list}>
                                    <RecentChip term={term} selected={false} onTerm={onTerm} onRemove={onRemoveRecent} isHi={isHi} />
                                </Animated.View>
                            ))}
                        </View>
                    </AnimatedListItem>
                </Animated.View>
            ) : null}

            <Animated.View layout={layout.list}>
                <AnimatedListItem index={2} style={styles.section}>
                    <SectionHeader title={isHi ? 'खोजकर देखें' : 'Try searching'} />
                    <View style={styles.chips}>
                        {SUGGESTED.map(([en, hi, icon], i) => {
                            const term = isHi ? hi : en;
                            return (
                                <Animated.View key={en} entering={layout.enterAt(i + 2)}>
                                    <TrendingTerm label={term} icon={icon} onPress={() => onTerm(term)} />
                                </Animated.View>
                            );
                        })}
                    </View>
                </AnimatedListItem>
            </Animated.View>

            {categories.length > 0 ? (
                <Animated.View layout={layout.list}>
                <AnimatedListItem index={3} style={styles.section}>
                    <SectionHeader title={isHi ? 'लोकप्रिय श्रेणियाँ' : 'Popular categories'} />
                    <View style={styles.grid}>
                        {categories.slice(0, 8).map((c) => (
                            <CategoryTile key={c._id || c.id} category={c} isHi={isHi} onPress={() => onCategory(c)} />
                        ))}
                    </View>
                </AnimatedListItem>
                </Animated.View>
            ) : null}
        </Animated.ScrollView>
    );
}

const useStyles = makeStyles((t) => ({
    // sections sit 28 apart; inside a section the header-to-content gap is 12
    wrap: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space['2xl'] + space.xs },
    section: { gap: space.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    trend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + space.xxs,
        height: 36,
        paddingHorizontal: space.md,
        borderRadius: radii.chip,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, marginHorizontal: -space.xs },
    tile: { width: '25%', alignItems: 'center', paddingHorizontal: space.xs },
    tileWell: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: radii.well,
        backgroundColor: t.colors.imageWell,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileImg: { width: '100%', height: '100%' },
    tileName: { marginTop: space.xs + 2 },
    // invisible hit area over the chip's trailing × (the Chip itself stays one control)
    remove: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 30, borderRadius: radii.pill },
}));

export default memo(SearchIdle);
