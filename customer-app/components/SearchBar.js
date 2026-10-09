import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Search01Icon, Mic01Icon, Camera01Icon } from 'hugeicons-react-native';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const ROTATING_PLACEHOLDERS = [
    "Search 'atta, dal, rice'",
    "Search 'milk, paneer, butter'",
    "Search 'chips, snacks, drinks'",
    "Search 'oil, ghee, masala'",
    "Search 'chocolates, ice cream'",
];

const SearchBar = ({
    onPress,
    onChangeText,
    value,
    placeholder,
    editable = false,
    autoFocus = false,
    showVoice = true,
    showCamera = false,
    showQuickTags = false,
}) => {
    const { t } = useTranslation();
    const isInteractive = editable || onChangeText;

    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const translateYAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (placeholder || isInteractive) return;

        const interval = setInterval(() => {
            // Slide up & Fade out
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(translateYAnim, {
                    toValue: -14,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // Change text & reset position to bottom
                setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
                translateYAnim.setValue(14);
                // Slide up from bottom & Fade in
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 350,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateYAnim, {
                        toValue: 0,
                        duration: 350,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [placeholder, isInteractive, fadeAnim, translateYAnim]);

    const activePlaceholder = placeholder || ROTATING_PLACEHOLDERS[placeholderIndex];

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={!isInteractive ? onPress : undefined}
            activeOpacity={isInteractive ? 1 : 0.9}
            disabled={isInteractive}
        >
            <View style={styles.searchBox}>
                {/* Search Icon */}
                <View style={styles.searchIconWrapper}>
                    <Search01Icon
                        size={20}
                        color={COLORS.primary || '#16A34A'}
                        strokeWidth={2}
                    />
                </View>

                {/* Input / Animated Placeholder Display */}
                {isInteractive ? (
                    <TextInput
                        style={styles.input}
                        placeholder={placeholder || t('searchPlaceholder')}
                        placeholderTextColor="#94A3B8"
                        editable={true}
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus={autoFocus}
                        returnKeyType="search"
                    />
                ) : (
                    <View style={styles.textWrapper}>
                        <Animated.Text
                            style={[
                                styles.placeholderText,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: translateYAnim }],
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {activePlaceholder}
                        </Animated.Text>
                    </View>
                )}

                {/* Right Actions */}
                <View style={styles.rightActions}>
                    {showVoice && (
                        <>
                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.7}>
                                <Mic01Icon
                                    size={20}
                                    color="#64748B"
                                    strokeWidth={2}
                                />
                            </TouchableOpacity>
                        </>
                    )}
                    {showCamera && (
                        <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.7}>
                            <Camera01Icon
                                size={20}
                                color="#64748B"
                                strokeWidth={2}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Quick Search Tags */}
            {!isInteractive && showQuickTags && (
                <View style={styles.quickTags}>
                    <Text style={styles.quickTagsLabel}>{t('popular')}:</Text>
                    {['Atta', 'Oil', 'Milk', 'Sugar'].map((tag) => (
                        <TouchableOpacity key={tag} style={styles.quickTag} onPress={onPress}>
                            <Text style={styles.quickTagText}>{tag}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 0,
        marginVertical: 4,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    searchIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#1E293B',
        marginLeft: 10,
        fontWeight: '500',
    },
    textWrapper: {
        flex: 1,
        marginLeft: 10,
        justifyContent: 'center',
        overflow: 'hidden',
        height: '100%',
    },
    placeholderText: {
        fontSize: 13.5,
        color: '#64748B',
        fontWeight: '500',
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 8,
    },
    actionButton: {
        padding: 4,
    },
    quickTags: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 8,
    },
    quickTagsLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    quickTag: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    quickTagText: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
    },
});

export default SearchBar;
