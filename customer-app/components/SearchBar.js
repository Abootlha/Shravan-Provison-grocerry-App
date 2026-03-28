import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const SearchBar = ({
    onPress,
    onChangeText,
    value,
    placeholder,
    editable = false,
    autoFocus = false,
    showVoice = true,
    showCamera = false,
}) => {
    const { t } = useTranslation();
    const isInteractive = editable || onChangeText;
    const defaultPlaceholder = placeholder || t('searchPlaceholder');

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
                    <MaterialCommunityIcons
                        name="magnify"
                        size={20}
                        color={COLORS.secondary}
                    />
                </View>

                {/* Input */}
                <TextInput
                    style={styles.input}
                    placeholder={defaultPlaceholder}
                    placeholderTextColor={COLORS.textLight}
                    editable={isInteractive}
                    pointerEvents={isInteractive ? 'auto' : 'none'}
                    value={value}
                    onChangeText={onChangeText}
                    autoFocus={autoFocus}
                    returnKeyType="search"
                />

                {/* Right Actions */}
                <View style={styles.rightActions}>
                    {showVoice && (
                        <>
                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                                <MaterialCommunityIcons
                                    name="microphone-outline"
                                    size={20}
                                    color={COLORS.textSecondary}
                                />
                            </TouchableOpacity>
                        </>
                    )}
                    {showCamera && (
                        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                            <MaterialCommunityIcons
                                name="camera-outline"
                                size={20}
                                color={COLORS.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Quick Search Tags */}
            {!isInteractive && (
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
        paddingHorizontal: 16,
        marginVertical: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 50,
        ...SHADOWS.light,
    },
    searchIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
        marginLeft: 12,
        fontWeight: '500',
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 22,
        backgroundColor: COLORS.border,
        marginRight: 8,
    },
    actionButton: {
        padding: 6,
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
