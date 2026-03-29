import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Dimensions,
    TouchableOpacity,
    Animated,
    FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');

// Bold, expressive color palette inspired by Indian bazaars
const PALETTE = {
    saffron: '#E85D04',
    deepAmber: '#DC2F02',
    cream: '#FEF3E2',
    espresso: '#1A0F0A',
    turmeric: '#FFBA08',
    sage: '#264653',
    terracotta: '#BC6C25',
};

const OnboardingScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);

    // Dynamic onboarding data based on language
    const ONBOARDING_DATA = [
        {
            id: '1',
            icon: 'truck-fast',
            gradient: [PALETTE.saffron, PALETTE.deepAmber],
            accent: PALETTE.turmeric,
            tagline: t('onboarding1.tagline'),
            title: t('onboarding1.title'),
            description: t('onboarding1.description'),
            pattern: 'circles',
        },
        {
            id: '2',
            icon: 'leaf',
            gradient: [PALETTE.sage, '#1D3557'],
            accent: '#2A9D8F',
            tagline: t('onboarding2.tagline'),
            title: t('onboarding2.title'),
            description: t('onboarding2.description'),
            pattern: 'waves',
        },
        {
            id: '3',
            icon: 'tag-heart',
            gradient: [PALETTE.terracotta, PALETTE.espresso],
            accent: PALETTE.turmeric,
            tagline: t('onboarding3.tagline'),
            title: t('onboarding3.title'),
            description: t('onboarding3.description'),
            pattern: 'dots',
        },
    ];

    // Staggered entrance animations
    const taglineAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const descAnim = useRef(new Animated.Value(0)).current;
    const iconAnim = useRef(new Animated.Value(0)).current;
    const iconRotate = useRef(new Animated.Value(0)).current;
    const decorAnim = useRef(new Animated.Value(0)).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;

    const triggerEntranceAnimations = () => {
        // Reset all values
        taglineAnim.setValue(0);
        titleAnim.setValue(0);
        descAnim.setValue(0);
        iconAnim.setValue(0);
        iconRotate.setValue(0);
        decorAnim.setValue(0);

        // Orchestrated staggered reveal
        Animated.stagger(100, [
            // Decorative elements fade in
            Animated.timing(decorAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            // Icon springs in with rotation
            Animated.parallel([
                Animated.spring(iconAnim, {
                    toValue: 1,
                    friction: 6,
                    tension: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(iconRotate, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
            // Tagline slides up
            Animated.spring(taglineAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            // Title slides up
            Animated.spring(titleAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            // Description fades in
            Animated.timing(descAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // Initial button animation
    useEffect(() => {
        Animated.spring(buttonAnim, {
            toValue: 1,
            friction: 6,
            delay: 800,
            useNativeDriver: true,
        }).start();
        triggerEntranceAnimations();
    }, []);

    const handleNext = async () => {
        if (currentIndex < ONBOARDING_DATA.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
            triggerEntranceAnimations();
        } else {
            await completeOnboarding();
        }
    };

    const handleSkip = async () => {
        await completeOnboarding();
    };

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('onboardingComplete', 'true');
            navigation.replace('Login');
        } catch (error) {
            navigation.replace('Login');
        }
    };

    const currentSlide = ONBOARDING_DATA[currentIndex];
    const iconRotation = iconRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['-15deg', '0deg'],
    });

    const renderSlide = ({ item, index }) => (
        <View style={[styles.slide, { backgroundColor: item.gradient[0] }]}>
            {/* Gradient overlay */}
            <View style={[styles.gradientOverlay, { backgroundColor: item.gradient[1] }]} />

            {/* Decorative floating elements */}
            <Animated.View
                style={[
                    styles.decorCircle1,
                    {
                        backgroundColor: item.accent,
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                        transform: [{ scale: decorAnim }],
                    }
                ]}
            />
            <Animated.View
                style={[
                    styles.decorCircle2,
                    {
                        backgroundColor: item.accent,
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }),
                        transform: [{ scale: decorAnim }],
                    }
                ]}
            />
            <Animated.View
                style={[
                    styles.decorCircle3,
                    {
                        borderColor: item.accent,
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
                    }
                ]}
            />

            {/* Content */}
            <View style={styles.slideContent}>
                {/* Icon */}
                <Animated.View
                    style={[
                        styles.iconWrapper,
                        {
                            backgroundColor: `${item.accent}25`,
                            borderColor: item.accent,
                            opacity: iconAnim,
                            transform: [
                                { scale: iconAnim },
                                { rotate: iconRotation },
                            ],
                        }
                    ]}
                >
                    <MaterialCommunityIcons
                        name={item.icon}
                        size={64}
                        color={item.accent}
                    />
                </Animated.View>

                {/* Tagline */}
                <Animated.Text
                    style={[
                        styles.tagline,
                        {
                            color: item.accent,
                            opacity: taglineAnim,
                            transform: [{
                                translateY: taglineAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [30, 0],
                                }),
                            }],
                        }
                    ]}
                >
                    {item.tagline}
                </Animated.Text>

                {/* Title */}
                <Animated.Text
                    style={[
                        styles.title,
                        {
                            opacity: titleAnim,
                            transform: [{
                                translateY: titleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [40, 0],
                                }),
                            }],
                        }
                    ]}
                >
                    {item.title}
                </Animated.Text>

                {/* Description */}
                <Animated.Text
                    style={[
                        styles.description,
                        { opacity: descAnim }
                    ]}
                >
                    {item.description}
                </Animated.Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>{t('skip')}</Text>
                <MaterialCommunityIcons name="chevron-double-right" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={ONBOARDING_DATA}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
            />

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                {/* Pagination */}
                <View style={styles.pagination}>
                    {ONBOARDING_DATA.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex && styles.activeDot,
                            ]}
                        />
                    ))}
                </View>

                {/* Next Button */}
                <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            { backgroundColor: currentSlide.accent }
                        ]}
                        onPress={handleNext}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.nextButtonText}>
                            {currentIndex === ONBOARDING_DATA.length - 1 ? t('letsGo') : t('next')}
                        </Text>
                        <View style={styles.buttonIconWrapper}>
                            <MaterialCommunityIcons
                                name={currentIndex === ONBOARDING_DATA.length - 1 ? 'rocket-launch' : 'arrow-right'}
                                size={20}
                                color={currentSlide.accent}
                            />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PALETTE.espresso,
    },
    skipButton: {
        position: 'absolute',
        top: 55,
        right: 24,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 24,
    },
    skipText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    slide: {
        width: width,
        height: height,
        justifyContent: 'center',
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.4,
    },
    decorCircle1: {
        position: 'absolute',
        top: -height * 0.15,
        right: -width * 0.3,
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
    },
    decorCircle2: {
        position: 'absolute',
        bottom: height * 0.15,
        left: -width * 0.25,
        width: width * 0.5,
        height: width * 0.5,
        borderRadius: width * 0.25,
    },
    decorCircle3: {
        position: 'absolute',
        top: height * 0.25,
        left: -width * 0.1,
        width: width * 0.3,
        height: width * 0.3,
        borderRadius: width * 0.15,
        borderWidth: 2,
    },
    slideContent: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: 'center',
        paddingBottom: 180,
    },
    iconWrapper: {
        width: 130,
        height: 130,
        borderRadius: 40,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    tagline: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 3,
        marginBottom: 12,
    },
    title: {
        fontSize: 44,
        fontWeight: '900',
        color: PALETTE.cream,
        lineHeight: 52,
        marginBottom: 20,
        letterSpacing: -1,
    },
    description: {
        fontSize: 17,
        color: 'rgba(255,255,255,0.75)',
        lineHeight: 26,
        maxWidth: 300,
        fontWeight: '500',
    },
    bottomControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 32,
        paddingBottom: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    activeDot: {
        width: 32,
        backgroundColor: PALETTE.cream,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 28,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 32,
        gap: 14,
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: PALETTE.espresso,
        letterSpacing: 0.5,
    },
    buttonIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: PALETTE.cream,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default OnboardingScreen;
