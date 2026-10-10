/**
 * ContentSwap — crossfades between content STATES so nothing pops in: skeleton → data,
 * data → empty, error → data. The outgoing state fades out over 150ms on top (absolute, no
 * layout jump, not touchable) while the incoming one fades in over 220ms with a 6px rise.
 *
 * Props
 *   stateKey   string — the state you're showing ('loading' | 'empty' | 'error' | 'data' | anything).
 *              A change of key triggers the swap; re-renders with the same key just update in place.
 *   children   what to render for the CURRENT key (a snapshot of the old children is kept while it fades)
 *   offsetY    rise of the incoming state (default 6; 0 to disable)
 *   style      container style (the container is position:relative; size it like the content)
 *
 * Reduced motion: opacity only. First render never animates (the screen entrance covers it).
 *
 * Example
 *   <ContentSwap stateKey={loading ? 'loading' : items.length ? 'data' : 'empty'} style={{ flex: 1 }}>
 *     {loading ? <SkeletonGroup>…</SkeletonGroup> : items.length ? <FlashList … /> : <EmptyState … />}
 *   </ContentSwap>
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { springs, durations, easings } from '../../theme/motion';

function Layer({ leaving, animateIn, offsetY, onGone, fill, children }) {
    const reduce = useReducedMotion();
    const o = useSharedValue(animateIn ? 0 : 1);
    const y = useSharedValue(animateIn && !reduce ? offsetY : 0);

    useEffect(() => {
        if (animateIn) {
            o.value = withTiming(1, { duration: durations.base, easing: easings.out });
            if (!reduce) y.value = withSpring(0, springs.gentle);
        }
    }, []);

    useEffect(() => {
        if (!leaving) return;
        o.value = withTiming(0, { duration: durations.fast - 10, easing: easings.out }, (done) => {
            if (done) scheduleOnRN(onGone);
        });
    }, [leaving]);

    const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
    return (
        <Animated.View style={[leaving ? styles.leaving : fill && styles.fill, anim, { pointerEvents: leaving ? 'none' : 'auto' }]}>
            {children}
        </Animated.View>
    );
}

export function ContentSwap({ stateKey, children, offsetY = 6, style }) {
    // last COMMITTED children: when the key changes, this is the outgoing state's snapshot
    const lastNode = useRef(children);
    const [st, setSt] = useState({ key: stateKey, id: 0, animate: false, leavers: [] });

    if (st.key !== stateKey) {
        // derived-state update during render (React re-renders immediately, before commit)
        setSt((s) =>
            s.key === stateKey
                ? s
                : {
                      key: stateKey,
                      id: s.id + 1,
                      animate: true,
                      leavers: [...s.leavers.filter((x) => x.key !== stateKey), { key: s.key, id: s.id, node: lastNode.current }],
                  },
        );
    }

    useEffect(() => {
        lastNode.current = children;
    });

    const fill = StyleSheet.flatten(style)?.flex != null;
    return (
        <View style={[styles.wrap, style]}>
            <Layer key={st.id} animateIn={st.animate} offsetY={offsetY} fill={fill}>
                {children}
            </Layer>
            {st.leavers.map((l) => (
                <Layer
                    key={l.id}
                    leaving
                    offsetY={0}
                    onGone={() => setSt((s) => ({ ...s, leavers: s.leavers.filter((x) => x.id !== l.id) }))}
                >
                    {l.node}
                </Layer>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'relative' },
    fill: { flex: 1 },
    leaving: { ...StyleSheet.absoluteFill },
});

export default ContentSwap;
