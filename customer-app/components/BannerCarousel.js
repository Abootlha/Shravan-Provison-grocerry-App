import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Image,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 32;
const BANNER_HEIGHT = 160;

const BannerCarousel = ({ banners, autoPlayInterval = 4000 }) => {
    const scrollViewRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (banners.length <= 1) return;

        const timer = setInterval(() => {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0.7,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                const nextIndex = (currentIndex + 1) % banners.length;
                scrollViewRef.current?.scrollTo({
                    x: nextIndex * BANNER_WIDTH,
                    animated: true,
                });
                setCurrentIndex(nextIndex);

                // Fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            });
        }, autoPlayInterval);

        return () => clearInterval(timer);
    }, [currentIndex, banners.length, autoPlayInterval, fadeAnim]);

    const handleScroll = (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / BANNER_WIDTH);
        setCurrentIndex(index);
    };

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                decelerationRate="fast"
                snapToInterval={BANNER_WIDTH}
                contentContainerStyle={styles.scrollContent}
            >
                {banners.map((banner, index) => (
                    <Animated.View
                        key={banner.id}
                        style={[
                            styles.bannerWrapper,
                            { opacity: currentIndex === index ? fadeAnim : 0.85 }
                        ]}
                    >
                        <TouchableOpacity
                            style={[styles.banner, { backgroundColor: banner.color }]}
                            activeOpacity={0.95}
                        >
                            {/* Gradient overlay for better text readability */}
                            <View style={styles.gradientOverlay} />

                            <View style={styles.bannerContent}>
                                <View style={styles.textContainer}>
                                    {banner.tag && (
                                        <View style={styles.tagBadge}>
                                            <Text style={styles.tagText}>{banner.tag}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.subtitle}>{banner.subtitle}</Text>
                                    <Text style={styles.title}>{banner.title}</Text>
                                    <TouchableOpacity style={styles.shopButton}>
                                        <Text style={styles.shopButtonText}>Shop Now</Text>
                                        <MaterialCommunityIcons
                                            name="arrow-right"
                                            size={14}
                                            color={COLORS.text}
                                        />
                                    </TouchableOpacity>
                                </View>
                                <Image
                                    source={{ uri: banner.image }}
                                    style={styles.bannerImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </ScrollView>

            {/* Pagination Dots */}
            <View style={styles.pagination}>
                {banners.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            currentIndex === index ? styles.activeDot : styles.inactiveDot,
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    bannerWrapper: {
        width: BANNER_WIDTH,
    },
    banner: {
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    bannerContent: {
        flex: 1,
        flexDirection: 'row',
        padding: 22,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    tagBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    tagText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.white,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.white,
        opacity: 0.9,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.white,
        marginTop: 4,
        letterSpacing: -0.5,
    },
    shopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        alignSelf: 'flex-start',
        marginTop: 14,
        gap: 6,
        ...SHADOWS.light,
    },
    shopButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.text,
    },
    bannerImage: {
        width: 130,
        height: '100%',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 14,
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    activeDot: {
        backgroundColor: COLORS.secondary,
        width: 24,
    },
    inactiveDot: {
        backgroundColor: COLORS.lightGray,
        width: 6,
    },
});

export default BannerCarousel;
