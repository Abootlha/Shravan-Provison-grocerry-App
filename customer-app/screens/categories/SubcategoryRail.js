/**
 * SubcategoryRail — the 76pt left rail of the category listing (Part C #7, Blinkit/Zepto).
 * A canvas column of 48pt thumbs on the neutral image well (photo, else the subcategory's 3D icon to identify it) with a
 * two-line label. The selected row lifts onto the surface with a 3pt violet bar on its left edge (the one state colour);
 * row + bar slide together on a spring.
 * Items have a fixed height so the indicator position is pure arithmetic (no measuring).
 */
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Icon3D, icon3dFor, PressableScale, Text } from '../../components/ui';
import { fontFamily, radii, space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { springs, durations, easings, press } from '../../theme/motion';
import { imageOf, nameOf } from '../home/catalog';

export const RAIL_WIDTH = 76;
const ITEM_H = 96;
const THUMB = 48;
const BAR_H = 44;
const BAR_W = 3;

const RailItem = memo(({ item, selected, language, onSelect }) => {
    const styles = useStyles();
    const uri = imageOf(item);
    const name = nameOf(item, language);
    const onPress = useCallback(() => onSelect(item), [onSelect, item]);

    return (
        <PressableScale
            onPress={onPress}
            haptic="selection"
            scaleTo={press.scale}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={name}
            style={styles.item}
        >
            <View style={[styles.thumb, selected && styles.thumbOn]}>
                {uri ? (
                    <Image source={{ uri }} style={styles.img} contentFit="cover" transition={150} accessible={false} />
                ) : (
                    <Icon3D name={icon3dFor(item)} size={selected ? 34 : 30} />
                )}
            </View>
            <Text
                variant="caption"
                color={selected ? 'ink' : 'secondary'}
                align="center"
                numberOfLines={2}
                maxFontSizeMultiplier={1.2}
                style={[styles.label, selected && styles.labelOn]}
            >
                {name}
            </Text>
        </PressableScale>
    );
});

const SubcategoryRail = ({ items = [], selectedId, language, onSelect }) => {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const index = Math.max(0, items.findIndex((s) => s._id === selectedId));
    const y = useSharedValue(index * ITEM_H);
    const scrollRef = useRef(null);
    const viewportH = useRef(0);

    useEffect(() => {
        const target = index * ITEM_H;
        y.value = reduce ? withTiming(target, { duration: durations.fast, easing: easings.out }) : withSpring(target, springs.snappy);
        // keep the selection comfortably on screen
        if (scrollRef.current && viewportH.current) {
            scrollRef.current.scrollTo({ y: Math.max(0, target - viewportH.current / 2 + ITEM_H / 2), animated: true });
        }
    }, [index, reduce]);

    const indicator = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

    return (
        <View style={styles.rail}>
            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                onLayout={(e) => {
                    viewportH.current = e.nativeEvent.layout.height;
                }}
                accessibilityRole="tablist"
            >
                {items.length ? (
                    <Animated.View style={[styles.indicator, indicator, { pointerEvents: 'none' }]}>
                        <View style={styles.bar} />
                    </Animated.View>
                ) : null}
                {items.map((item) => (
                    <RailItem key={item._id} item={item} selected={item._id === selectedId} language={language} onSelect={onSelect} />
                ))}
            </ScrollView>
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    rail: { width: RAIL_WIDTH, backgroundColor: t.colors.canvas, borderRightWidth: StyleSheet.hairlineWidth * 2, borderRightColor: t.colors.hairline },
    content: { paddingBottom: 200 },
    item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxs }, // tight: long single words ("Vegetables") must fit one line, never break mid-word
    thumb: {
        width: THUMB,
        height: THUMB,
        borderRadius: radii.well,
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbOn: {},
    img: { width: '100%', height: '100%' },
    label: { marginTop: space.xs + space.xxs },
    labelOn: { fontFamily: fontFamily.semibold }, // semibold, not bold: bold widens long words past the rail
    indicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: ITEM_H,
        backgroundColor: t.colors.surface,
        justifyContent: 'center',
    },
    bar: {
        width: BAR_W,
        height: BAR_H,
        borderTopRightRadius: radii.xs,
        borderBottomRightRadius: radii.xs,
        backgroundColor: t.colors.brandText,
    },
}));

export default memo(SubcategoryRail);
