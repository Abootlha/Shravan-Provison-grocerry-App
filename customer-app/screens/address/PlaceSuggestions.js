import React, { memo } from 'react';
import { ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    AnimatedListItem,
    Badge,
    ContentSwap,
    Divider,
    EmptyState,
    PressableScale,
    SkeletonGroup,
    SkeletonListRow,
    Text,
} from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';

const SuggestionRow = memo(({ item, dist, deliverable, onSelect, isHi }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
    <PressableScale
        onPress={() => onSelect(item)}
        disabled={!deliverable}
        disabledOpacity={0.6}
        haptic="selection"
        scaleTo={press.subtle}
        accessibilityLabel={`${item.name}, ${item.formattedAddress}${deliverable ? '' : isHi ? ', डिलीवरी उपलब्ध नहीं' : ', not deliverable'}`}
        style={styles.row}
    >
        <View style={[styles.tile, { backgroundColor: deliverable ? colors.surfaceSunken : colors.errorTint }]}>
            <MaterialCommunityIcons
                name={deliverable ? 'map-marker-outline' : 'map-marker-off-outline'}
                size={20}
                color={deliverable ? colors.inkSecondary : colors.errorInk}
            />
        </View>
        <View style={styles.texts}>
            <Text variant="bodyStrong" numberOfLines={1}>{item.name}</Text>
            <Text variant="caption" color="muted" numberOfLines={2}>{item.formattedAddress}</Text>
            {dist != null ? (
                <Text variant="caption" color={deliverable ? 'secondary' : 'error'}>
                    {isHi ? `स्टोर से ${dist} किमी` : `${dist} km from store`}
                </Text>
            ) : null}
        </View>
        {!deliverable ? <Badge tone="error" size="sm" label={isHi ? 'उपलब्ध नहीं' : 'Not deliverable'} /> : null}
    </PressableScale>
    );
});

/**
 * Place search results: skeleton rows while loading, staggered rows once they land,
 * and places outside the delivery radius greyed out with a "Not deliverable" badge.
 * Skeleton → results → empty crossfade through ContentSwap (no pop).
 */
function PlaceSuggestionsBase({ loading, items, onSelect, distanceKm, radiusKm, isHi, style }) {
    const styles = useStyles();
    const state = loading && items.length === 0 ? 'loading' : items.length === 0 ? 'empty' : 'data';
    return (
        <View style={[styles.card, style]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <ContentSwap stateKey={state}>
            {state === 'loading' ? (
                <SkeletonGroup style={styles.skeletons}>
                    <SkeletonListRow />
                    <SkeletonListRow />
                    <SkeletonListRow />
                </SkeletonGroup>
            ) : state === 'empty' ? (
                <EmptyState
                    compact
                    mood="sad"
                    title={isHi ? 'कोई स्थान नहीं मिला' : 'No matching places'}
                    subtitle={isHi ? 'कोई दूसरा क्षेत्र या लैंडमार्क खोजें।' : 'Try a nearby area or landmark.'}
                />
            ) : (
                <View>
                    {items.map((item, index) => {
                        const dist = item.distanceKm != null ? item.distanceKm : distanceKm(item);
                        const deliverable = dist == null || dist <= radiusKm;
                        return (
                            <AnimatedListItem key={item.placeId || `${item.name}-${index}`} index={index}>
                                {index > 0 ? <Divider inset={56} /> : null}
                                <SuggestionRow item={item} dist={dist} deliverable={deliverable} onSelect={onSelect} isHi={isHi} />
                            </AnimatedListItem>
                        );
                    })}
                </View>
            )}
            </ContentSwap>
            </ScrollView>
        </View>
    );
}

export const PlaceSuggestions = memo(PlaceSuggestionsBase);

const useStyles = makeStyles((t) => ({
    card: {
        maxHeight: '100%',
        backgroundColor: t.colors.surface,
        borderRadius: radii.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        ...t.shadows.lg,
    },
    skeletons: { gap: space.md, paddingVertical: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: HIT + space.lg, paddingVertical: space.sm },
    tile: { width: 40, height: 40, borderRadius: radii.well, alignItems: 'center', justifyContent: 'center' },
    texts: { flex: 1, gap: space.xxs },
}));

export default PlaceSuggestions;
