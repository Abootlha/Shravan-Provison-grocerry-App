import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, CATEGORIES, CATEGORY_GROUPS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 4;
const ITEM_SPACING = 12;
const HORIZONTAL_PADDING = 16;
const ITEM_WIDTH = (width - (HORIZONTAL_PADDING * 2) - (ITEM_SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

const CategoriesScreen = ({ navigation }) => {
    const { t, currentLanguage } = useTranslation();
    const [translatedCategories, setTranslatedCategories] = useState(CATEGORIES);
    const [translatedGroups, setTranslatedGroups] = useState(CATEGORY_GROUPS);

    // Translate categories and groups when language changes
    useEffect(() => {
        translateData();
    }, [currentLanguage]);

    const translateData = async () => {
        if (currentLanguage === 'en') {
            // Reset to original English
            setTranslatedCategories(CATEGORIES);
            setTranslatedGroups(CATEGORY_GROUPS);
            return;
        }

        if (currentLanguage === 'hi') {
            try {
                // Translate categories and groups in parallel
                const [translatedCats, translatedGrps] = await Promise.all([
                    Promise.all(
                        CATEGORIES.map(async (cat) => ({
                            ...cat,
                            translatedName: await translateToHindi(cat.name)
                        }))
                    ),
                    Promise.all(
                        CATEGORY_GROUPS.map(group => translateToHindi(group))
                    )
                ]);
                
                // Set both states together to avoid intermediate renders
                setTranslatedCategories(translatedCats);
                setTranslatedGroups(translatedGrps);
            } catch (err) {
                console.error('Translation error:', err);
                // Fallback to English on error
                setTranslatedCategories(CATEGORIES);
                setTranslatedGroups(CATEGORY_GROUPS);
            }
        }
    };
    // Group categories by their group field
    const groupedCategories = useMemo(() => {
        const groups = {};
        translatedGroups.forEach((group, index) => {
            const originalGroup = CATEGORY_GROUPS[index];
            groups[group] = translatedCategories.filter(cat => cat.group === originalGroup);
        });
        return groups;
    }, [translatedCategories, translatedGroups]);

    const handleCategoryPress = (category) => {
        navigation.navigate('Category', { category });
    };

    const handleSearchPress = () => {
        navigation.navigate('Search');
    };

    const renderCategoryItem = (category) => {
        const displayName = currentLanguage === 'hi' && category.translatedName 
            ? category.translatedName 
            : category.name;
        
        return (
            <TouchableOpacity
                key={category.id}
                style={styles.categoryItem}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
            >
                <View style={[styles.imageContainer, { backgroundColor: category.color }]}>
                    <Image
                        source={{ uri: category.image }}
                        style={styles.categoryImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
                    {displayName}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderCategoryGrid = (categories) => {
        const rows = [];
        for (let i = 0; i < categories.length; i += COLUMN_COUNT) {
            const rowItems = categories.slice(i, i + COLUMN_COUNT);
            rows.push(
                <View key={i} style={styles.row}>
                    {rowItems.map(renderCategoryItem)}
                    {/* Fill empty slots to maintain grid alignment */}
                    {rowItems.length < COLUMN_COUNT &&
                        Array(COLUMN_COUNT - rowItems.length).fill(null).map((_, index) => (
                            <View key={`empty-${index}`} style={styles.emptySlot} />
                        ))
                    }
                </View>
            );
        }
        return rows;
    };

    const renderSection = (groupName) => {
        const categories = groupedCategories[groupName];
        if (!categories || categories.length === 0) return null;

        return (
            <View key={groupName} style={styles.section}>
                <Text style={styles.sectionTitle}>{groupName}</Text>
                <View style={styles.grid}>
                    {renderCategoryGrid(categories)}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialCommunityIcons
                        name="chevron-left"
                        size={28}
                        color={COLORS.text}
                    />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={styles.deliveryInfo}>
                        <MaterialCommunityIcons
                            name="lightning-bolt"
                            size={16}
                            color="#E91E63"
                        />
                        <Text style={styles.deliveryTime}>10 {t('minutes')}</Text>
                    </View>
                    <Text style={styles.locationText} numberOfLines={1}>
                        Shravan Kirana Store
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearchPress}
                >
                    <MaterialCommunityIcons
                        name="magnify"
                        size={24}
                        color={COLORS.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Categories Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {translatedGroups.map(renderSection)}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
    },
    backButton: {
        padding: 4,
    },
    headerCenter: {
        flex: 1,
        marginLeft: 8,
    },
    deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deliveryTime: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginLeft: 4,
    },
    locationText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    searchButton: {
        padding: 8,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 24,
    },
    section: {
        paddingHorizontal: HORIZONTAL_PADDING,
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
    },
    grid: {

    },
    row: {
        flexDirection: 'row',
        marginBottom: ITEM_SPACING,
    },
    categoryItem: {
        width: ITEM_WIDTH,
        marginRight: ITEM_SPACING,
        alignItems: 'center',
    },
    emptySlot: {
        width: ITEM_WIDTH,
        marginRight: ITEM_SPACING,
    },
    imageContainer: {
        width: ITEM_WIDTH - 8,
        height: ITEM_WIDTH - 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    categoryImage: {
        width: '65%',
        height: '65%',
    },
    categoryName: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.text,
        textAlign: 'center',
        lineHeight: 14,
    },
});

export default CategoriesScreen;
