import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
    DeviceEventEmitter,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { COLORS, CATEGORIES, CATEGORY_GROUPS, SHADOWS } from '../constants';
import { Header, SearchBar, CategoryCard } from '../components';
import { ProductService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 12;
const HORIZONTAL_PADDING = 14;
const ITEM_WIDTH = Math.floor((width - (HORIZONTAL_PADDING * 2) - (ITEM_SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT);

const PASTEL_PALETTE = ['#FFF3E0', '#E8F5E9', '#E3F2FD', '#F3E5F5', '#FFF8E1', '#FCE4EC', '#E0F2F1', '#FFEBEE'];

const CategoriesScreen = ({ navigation }) => {
    const { t, currentLanguage } = useTranslation();
    const cartItems = useSelector((state) => state.cart.totalItems);
    const { selectedAddress } = useSelector((state) => state.location);

    const scrollY = useRef(new Animated.Value(0)).current;
    const lastScrollY = useRef(0);

    const handleScroll = (event) => {
        const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
        scrollY.setValue(currentY);
        DeviceEventEmitter.emit('ON_SCROLL_Y', currentY);
    };

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [translatedGroups, setTranslatedGroups] = useState(CATEGORY_GROUPS);

    useEffect(() => {
        fetchData();
    }, [currentLanguage]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch real categories from backend API
            const apiCategories = await ProductService.getCategories();
            let rawList = (apiCategories && apiCategories.length > 0) ? apiCategories : CATEGORIES;

            if (currentLanguage === 'hi') {
                try {
                    const [translatedCats, translatedGrps] = await Promise.all([
                        Promise.all(
                            rawList.map(async (cat) => ({
                                ...cat,
                                translatedName: cat.nameHi || await translateToHindi(cat.name)
                            }))
                        ),
                        Promise.all(
                            CATEGORY_GROUPS.map(group => translateToHindi(group))
                        )
                    ]);
                    setCategories(translatedCats);
                    setTranslatedGroups(translatedGrps);
                } catch (translationErr) {
                    console.error('Translation error in CategoriesScreen:', translationErr);
                    setCategories(rawList);
                    setTranslatedGroups(CATEGORY_GROUPS);
                }
            } else {
                setCategories(rawList);
                setTranslatedGroups(CATEGORY_GROUPS);
            }
        } catch (err) {
            console.error('Error loading categories:', err);
            setCategories(CATEGORIES);
            setTranslatedGroups(CATEGORY_GROUPS);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPress = (category) => {
        navigation.navigate('Category', { category });
    };

    const handleSearchPress = () => {
        navigation.navigate('Search');
    };

    const handleLocationPress = () => {
        navigation.navigate('Location');
    };

    const renderCategoryItem = (category, index) => {
        const displayName = currentLanguage === 'hi' && category.translatedName 
            ? category.translatedName 
            : category.name;

        const imageUrl = category.icon || category.image;

        return (
            <CategoryCard
                key={category._id || category.id || index}
                category={{
                    id: category._id || category.id,
                    name: displayName,
                    icon: category.icon || 'package-variant',
                    color: category.color,
                    image: imageUrl
                }}
                index={index}
                onPress={() => handleCategoryPress(category)}
                size="medium"
                width={ITEM_WIDTH}
            />
        );
    };

    const renderCategoryGrid = (categoryList) => {
        const rows = [];
        for (let i = 0; i < categoryList.length; i += COLUMN_COUNT) {
            const rowItems = categoryList.slice(i, i + COLUMN_COUNT);
            rows.push(
                <View key={i} style={styles.row}>
                    {rowItems.map((item, idx) => renderCategoryItem(item, i + idx))}
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

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    addressDetail={selectedAddress ? `${selectedAddress.address}` : 'Chavri Road, Market Area'}
                    deliveryTime="10 minutes"
                    onLocationPress={handleLocationPress}
                    onProfilePress={() => navigation.navigate('Main', { screen: 'Account' })}
                    onWalletPress={() => navigation.navigate('Main', { screen: 'Account' })}
                >
                    <View style={styles.embeddedSearchWrapper}>
                        <SearchBar onPress={handleSearchPress} />
                    </View>
                </Header>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.secondary} />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            {/* Sticky Header with Animated Collapsible Hero & Embedded SearchBar */}
            <View style={styles.stickyHeaderWrapper}>
                <Header
                    showLocation
                    location={selectedAddress?.type || 'Home'}
                    addressDetail={selectedAddress ? `${selectedAddress.address}` : 'Chavri Road, Market Area'}
                    deliveryTime="10 minutes"
                    onLocationPress={handleLocationPress}
                    onProfilePress={() => navigation.navigate('Main', { screen: 'Account' })}
                    onWalletPress={() => navigation.navigate('Main', { screen: 'Account' })}
                    scrollY={scrollY}
                >
                    <View style={styles.embeddedSearchWrapper}>
                        <SearchBar onPress={handleSearchPress} />
                    </View>
                </Header>
            </View>

            {/* Scrollable Categories List */}
            <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
                onScroll={handleScroll}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {currentLanguage === 'hi' ? 'सभी श्रेणियाँ' : 'All Categories'}
                    </Text>
                    <View style={styles.grid}>
                        {renderCategoryGrid(categories)}
                    </View>
                </View>
            </Animated.ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    stickyHeaderWrapper: {
        zIndex: 100,
        backgroundColor: 'transparent',
    },
    embeddedSearchWrapper: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        paddingTop: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 4,
        paddingBottom: 90,
    },
    section: {
        paddingHorizontal: HORIZONTAL_PADDING,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'column',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    emptySlot: {
        width: ITEM_WIDTH,
    },
});

export default CategoriesScreen;
