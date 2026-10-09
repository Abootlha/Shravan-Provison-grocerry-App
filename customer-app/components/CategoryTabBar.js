import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * Premium Ecommerce Category Tab Navigation
 * Features continuous 2px bottom line with smooth SVG folder-tab curves.
 * Includes smooth 220ms sliding animation when switching between tabs.
 */
const CategoryTabBar = ({
    tabs = [],
    activeTabId,
    onTabSelect,
    brandColor = '#7C3AED',
    activeBgColor = '#F3E8FF',
    inactiveTextColor = '#1E293B',
    containerStyle,
}) => {
    const [tabLayouts, setTabLayouts] = useState({});

    // Animated values for smooth shifting transition
    const animX = useRef(new Animated.Value(0)).current;
    const animWidth = useRef(new Animated.Value(0)).current;
    const isFirstRender = useRef(true);

    const [currentX, setCurrentX] = useState(0);
    const [currentWidth, setCurrentWidth] = useState(0);

    const handleLayout = (id, event) => {
        const { x, width } = event.nativeEvent.layout;
        setTabLayouts((prev) => ({
            ...prev,
            [id]: { x, width },
        }));
    };

    const activeLayout = tabLayouts[activeTabId];

    useEffect(() => {
        if (activeLayout) {
            if (isFirstRender.current) {
                animX.setValue(activeLayout.x);
                animWidth.setValue(activeLayout.width);
                setCurrentX(activeLayout.x);
                setCurrentWidth(activeLayout.width);
                isFirstRender.current = false;
            } else {
                Animated.parallel([
                    Animated.timing(animX, {
                        toValue: activeLayout.x,
                        duration: 220,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: false,
                    }),
                    Animated.timing(animWidth, {
                        toValue: activeLayout.width,
                        duration: 220,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: false,
                    }),
                ]).start();
            }
        }
    }, [activeTabId, activeLayout]);

    useEffect(() => {
        const xListener = animX.addListener(({ value }) => setCurrentX(value));
        const wListener = animWidth.addListener(({ value }) => setCurrentWidth(value));
        return () => {
            animX.removeListener(xListener);
            animWidth.removeListener(wListener);
        };
    }, []);

    const renderActiveTabSvg = () => {
        const h = 42; // Height of active tab above baseline
        const flare = 10; // Outward bottom curve radius
        const topRadius = 12; // Top corners radius
        const strokeWidth = 1.2;
        const bottomY = h;
        const topY = 2;

        const svgWidth = 2000;

        if (currentWidth === 0) {
            return (
                <View style={styles.svgAbsoluteWrapper} pointerEvents="none">
                    <Svg width={svgWidth} height={h + 4}>
                        <Path
                            d={`M 0 ${bottomY} L ${svgWidth} ${bottomY}`}
                            stroke={brandColor}
                            strokeWidth={strokeWidth}
                        />
                    </Svg>
                </View>
            );
        }

        const x = currentX;
        const width = currentWidth;

        const startX = Math.max(0, x - flare);
        const endX = x + width + flare;
        const leftWallX = x;
        const rightWallX = x + width;

        // Active tab interior gradient fill
        const fillPathData = `
            M ${startX} ${bottomY}
            C ${startX + flare * 0.5} ${bottomY}, ${leftWallX} ${bottomY - flare * 0.5}, ${leftWallX} ${bottomY - flare}
            L ${leftWallX} ${topY + topRadius}
            C ${leftWallX} ${topY + topRadius * 0.3}, ${leftWallX + topRadius * 0.3} ${topY}, ${leftWallX + topRadius} ${topY}
            L ${rightWallX - topRadius} ${topY}
            C ${rightWallX - topRadius * 0.3} ${topY}, ${rightWallX} ${topY + topRadius * 0.3}, ${rightWallX} ${topY + topRadius}
            L ${rightWallX} ${bottomY - flare}
            C ${rightWallX} ${bottomY - flare * 0.5}, ${endX - flare * 0.5} ${bottomY}, ${endX} ${bottomY}
            Z
        `;

        // Continuous single path: Left Line -> Tab Curve -> Right Line
        const strokePathData = `
            M 0 ${bottomY}
            L ${startX} ${bottomY}
            C ${startX + flare * 0.5} ${bottomY}, ${leftWallX} ${bottomY - flare * 0.5}, ${leftWallX} ${bottomY - flare}
            L ${leftWallX} ${topY + topRadius}
            C ${leftWallX} ${topY + topRadius * 0.3}, ${leftWallX + topRadius * 0.3} ${topY}, ${leftWallX + topRadius} ${topY}
            L ${rightWallX - topRadius} ${topY}
            C ${rightWallX - topRadius * 0.3} ${topY}, ${rightWallX} ${topY + topRadius * 0.3}, ${rightWallX} ${topY + topRadius}
            L ${rightWallX} ${bottomY - flare}
            C ${rightWallX} ${bottomY - flare * 0.5}, ${endX - flare * 0.5} ${bottomY}, ${endX} ${bottomY}
            L ${svgWidth} ${bottomY}
        `;

        return (
            <View style={styles.svgAbsoluteWrapper} pointerEvents="none">
                <Svg width={svgWidth} height={h + 4} style={{ position: 'absolute', bottom: 0, left: 0 }}>
                    <Defs>
                        <LinearGradient id="activeTabGradient" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={activeBgColor} stopOpacity="1" />
                            <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                        </LinearGradient>
                    </Defs>

                    {/* Gradient Fill inside active tab */}
                    <Path d={fillPathData} fill="url(#activeTabGradient)" />

                    {/* Continuous Stroke Path */}
                    <Path
                        d={strokePathData}
                        fill="none"
                        stroke={brandColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            </View>
        );
    };

    return (
        <View style={[styles.container, containerStyle]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                bounces={false}
            >
                {/* SVG Baseline and Smooth Shifting Active Tab Curve */}
                {renderActiveTabSvg()}

                {tabs.map((tab) => {
                    const isActive = activeTabId === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onLayout={(e) => handleLayout(tab.id, e)}
                            style={styles.tabButton}
                            onPress={() => onTabSelect && onTabSelect(tab.id)}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    { color: inactiveTextColor },
                                    isActive && [styles.activeTabText, { color: brandColor }],
                                ]}
                            >
                                {tab.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
        height: 52,
        justifyContent: 'flex-end',
        marginVertical: 10,
    },
    scrollContent: {
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
        position: 'relative',
        minHeight: 46,
        zIndex: 2,
    },
    svgAbsoluteWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    tabButton: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 11,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    activeTabText: {
        fontWeight: '800',
    },
});

export default CategoryTabBar;
