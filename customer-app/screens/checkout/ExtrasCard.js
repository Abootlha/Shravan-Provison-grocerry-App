import React, { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Divider, PressableScale, Text } from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { durations, press, springs } from '../../theme/motion';
import { GROUP_RADIUS, ICON_CIRCLE } from './layout';
import { TipSelector } from './TipSelector';
import { DeliveryInstructionsCard } from './DeliveryInstructionsCard';
import { getInstructionOptions } from './useCheckout';

/** A single tappable row that expands its options inline (chevron turns, body slides in). */
function ExpandRow({ icon, title, subtitle, open, onToggle, children }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const turn = useSharedValue(open ? 1 : 0);
    useEffect(() => {
        turn.value = reduce ? withTiming(open ? 1 : 0, { duration: durations.fast }) : withSpring(open ? 1 : 0, springs.snappy);
    }, [open, reduce]);
    const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));
    return (
        <Animated.View layout={layout.list}>
            <PressableScale
                onPress={onToggle}
                haptic="light"
                scaleTo={press.subtle}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
                style={styles.row}
            >
                <View style={styles.icon}>
                    <MaterialCommunityIcons name={icon} size={20} color={colors.inkSecondary} />
                </View>
                <View style={styles.texts}>
                    <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
                    {subtitle ? <Text variant="caption" color="muted" numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                <Animated.View style={chevron}>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkMuted} />
                </Animated.View>
            </PressableScale>
            {open ? (
                <Animated.View entering={layout.enterDown} exiting={layout.exit} style={styles.body}>
                    {children}
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}

/**
 * Tip and delivery instructions, after the bill: two single rows ("Add a tip for your delivery partner ›",
 * "Delivery instructions ›") that expand inline. A chosen tip / instruction shows as the row's
 * summary while collapsed.
 */
function ExtrasCardBase({ tip, onChangeTip, selected, onToggle, note, onChangeNote, isHi }) {
    const styles = useStyles();
    const [openTip, setOpenTip] = useState(false);
    const [openNotes, setOpenNotes] = useState(false);

    const chosen = getInstructionOptions(isHi).filter((o) => selected.includes(o.id)).map((o) => o.label);
    if (note?.trim()) chosen.push(note.trim());

    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <ExpandRow
                icon="hand-heart-outline"
                title={tip > 0
                    ? (isHi ? `डिलीवरी पार्टनर के लिए ₹${tip} टिप` : `₹${tip} tip for your delivery partner`)
                    : (isHi ? 'डिलीवरी पार्टनर के लिए टिप जोड़ें' : 'Add a tip for your delivery partner')}
                subtitle={isHi ? 'बिल में नहीं जुड़ती। दरवाज़े पर उन्हें दें, पूरी उन्हीं की है' : 'Not added to your bill. Give it to them at the door; all of it is theirs'}
                open={openTip}
                onToggle={() => setOpenTip((v) => !v)}
            >
                <TipSelector bare tip={tip} onChange={onChangeTip} isHi={isHi} />
            </ExpandRow>
            <Divider inset={space.lg} />
            <ExpandRow
                icon="message-text-outline"
                title={isHi ? 'डिलीवरी निर्देश' : 'Delivery instructions'}
                subtitle={chosen.length ? chosen.join(', ') : (isHi ? 'डिलीवरी पार्टनर को बताएं कि कैसे पहुँचाना है' : 'Tell your delivery partner how to hand it over')}
                open={openNotes}
                onToggle={() => setOpenNotes((v) => !v)}
            >
                <DeliveryInstructionsCard bare selected={selected} onToggle={onToggle} note={note} onChangeNote={onChangeNote} isHi={isHi} />
            </ExpandRow>
        </Card>
    );
}

export const ExtrasCard = memo(ExtrasCardBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT + space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
    },
    icon: {
        width: ICON_CIRCLE,
        height: ICON_CIRCLE,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
    body: { paddingHorizontal: space.lg, paddingBottom: space.lg },
}));

export default ExtrasCard;
