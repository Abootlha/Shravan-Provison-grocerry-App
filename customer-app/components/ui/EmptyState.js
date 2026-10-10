/**
 * EmptyState — mascot-led empty / error / unavailable state.
 *
 * Props
 *   mood          Mascot mood: 'sleepy' (default; empty) | 'sad' (error/unavailable) | 'happy' | 'loading'
 *   title         string — say what's going on ("Your cart is empty")
 *   subtitle      string — say what to do next ("Add items to get them in 10 minutes")
 *   actionLabel   string — primary action label
 *   onAction      () => void
 *   secondaryLabel / onSecondary   optional ghost action ("Try again" + "Go home")
 *   compact       boolean — smaller mascot/spacing for inline use inside a card or sheet
 *   sticker       @deprecated — ignored (DESIGN.md: no floating sticker clusters; the mascot alone, static)
 *   style
 *
 * Example
 *   <EmptyState title="Your cart is empty" subtitle="Fresh groceries are 10 minutes away."
 *     actionLabel="Start shopping" onAction={() => navigation.navigate('Home')} />
 *   <EmptyState mood="sad" title="We're not in your area yet" subtitle="We're expanding fast — check back soon." />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { space } from '../../constants/theme';
import { Mascot } from './Mascot';
import { Text } from './Text';
import { Button } from './Button';
import { useStaggeredEntrance } from './AnimatedListItem';

export function EmptyState({
    mood = 'sleepy',
    title,
    subtitle,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
    compact = false,
    sticker, // eslint-disable-line no-unused-vars -- deprecated, ignored
    style,
}) {
    const mascot = compact ? 96 : 140;
    const a0 = useStaggeredEntrance(0, { delay: 70 });
    const a1 = useStaggeredEntrance(1, { delay: 70 });
    const a2 = useStaggeredEntrance(2, { delay: 70 });
    return (
        <View style={[styles.wrap, compact && styles.compact, style]}>
            <Animated.View style={a0}>
                {/* the staggered wrapper is the single entrance; the mascot itself stays still */}
                <Mascot mood={mood} size={mascot} animated={false} />
            </Animated.View>
            <Animated.View style={[styles.texts, a1]}>
                {title ? (
                    <Text variant={compact ? 'title' : 'h3'} align="center" accessibilityRole="header">
                        {title}
                    </Text>
                ) : null}
                {subtitle ? (
                    <Text variant="body" color="secondary" align="center" style={styles.sub}>
                        {subtitle}
                    </Text>
                ) : null}
            </Animated.View>
            {actionLabel || secondaryLabel ? (
                <Animated.View style={[styles.actions, a2]}>
                    {actionLabel ? <Button label={actionLabel} onPress={onAction} size={compact ? 'sm' : 'md'} /> : null}
                    {secondaryLabel ? (
                        <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" size={compact ? 'sm' : 'md'} />
                    ) : null}
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space['2xl'], paddingVertical: space['3xl'] },
    compact: { paddingVertical: space.xl, paddingHorizontal: space.lg },
    texts: { marginTop: space.lg, maxWidth: 300, alignItems: 'center' },
    sub: { marginTop: space.sm },
    actions: { marginTop: space.xl, alignItems: 'center', gap: space.xs },
});

export default EmptyState;
