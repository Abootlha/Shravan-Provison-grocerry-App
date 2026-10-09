import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

/**
 * Animated Pulse Skeleton Card Placeholder for Progressive Horizontal Loading
 */
const ProductCardSkeleton = () => {
    const fadeAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 0.9,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0.4,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [fadeAnim]);

    return (
        <View style={styles.container}>
            {/* Image Placeholder */}
            <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim }]} />

            {/* Details Section Placeholder */}
            <View style={styles.details}>
                {/* Price Row */}
                <Animated.View style={[styles.pricePlaceholder, { opacity: fadeAnim }]} />
                {/* Savings Pill */}
                <Animated.View style={[styles.savingsPlaceholder, { opacity: fadeAnim }]} />
                {/* Title Lines */}
                <Animated.View style={[styles.titleLine1, { opacity: fadeAnim }]} />
                <Animated.View style={[styles.titleLine2, { opacity: fadeAnim }]} />
                {/* Unit */}
                <Animated.View style={[styles.unitPlaceholder, { opacity: fadeAnim }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 155,
        height: 260,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        marginRight: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    imageWrapper: {
        width: '100%',
        height: 145,
        backgroundColor: '#E2E8F0',
    },
    details: {
        padding: 10,
        gap: 6,
    },
    pricePlaceholder: {
        width: '50%',
        height: 16,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
    },
    savingsPlaceholder: {
        width: '40%',
        height: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
    },
    titleLine1: {
        width: '90%',
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
    },
    titleLine2: {
        width: '65%',
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
    },
    unitPlaceholder: {
        width: '35%',
        height: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 4,
        marginTop: 2,
    },
});

export default ProductCardSkeleton;
