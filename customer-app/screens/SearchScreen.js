import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ProductCard } from '../components';
import { COLORS, PRODUCTS, CATEGORIES } from '../constants';
import { useTranslation } from '../hooks/useTranslation';
import { translateToHindi } from '../services/translationService';

const SearchScreen = ({ navigation }) => {
    const { currentLanguage } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    const recentSearches = [
        'Milk',
        'Fresh vegetables',
        'Bread',
        'Eggs',
        'Butter',
    ];

    const trendingSearches = [
        'Organic fruits',
        'Dairy products',
        'Snacks',
        'Cold drinks',
        'Cleaning products',
    ];

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.length > 0) {
            const results = PRODUCTS.filter((product) =>
                product.name.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(results);
            setShowResults(true);
        } else {
            setSearchResults([]);
            setShowResults(false);
        }
    };

    // Translate search results when language changes
    useEffect(() => {
        const translateResults = async () => {
            if (currentLanguage === 'hi' && searchResults.length > 0) {
                try {
                    const translated = await Promise.all(
                        searchResults.map(async (product) => ({
                            ...product,
                            translatedName: product.nameHi || await translateToHindi(product.name)
                        }))
                    );
                    setSearchResults(translated);
                } catch (err) {
                    console.error('Translation error:', err);
                }
            }
        };

        translateResults();
    }, [currentLanguage]);

    const handleSearchPress = (term) => {
        setSearchQuery(term);
        handleSearch(term);
    };

    const handleProductPress = (product) => {
        navigation.navigate('ProductDetail', { product });
    };

    const handleBackPress = () => {
        navigation.goBack();
    };

    const renderProduct = ({ item }) => {
        const displayName = currentLanguage === 'hi' && item.translatedName 
            ? item.translatedName 
            : item.name;
        
        return (
            <View style={styles.productWrapper}>
                <ProductCard 
                    product={{
                        ...item,
                        name: displayName
                    }} 
                    onPress={() => handleProductPress(item)} 
                />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Search Header */}
            <View style={styles.searchHeader}>
                <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <View style={styles.searchInputContainer}>
                    <MaterialCommunityIcons name="magnify" size={22} color={COLORS.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for products..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoFocus
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {showResults ? (
                /* Search Results */
                <FlatList
                    data={searchResults}
                    renderItem={renderProduct}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.resultGrid}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons
                                name="magnify-close"
                                size={60}
                                color={COLORS.lightGray}
                            />
                            <Text style={styles.emptyTitle}>No results found</Text>
                            <Text style={styles.emptySubtitle}>
                                Try searching with a different keyword
                            </Text>
                        </View>
                    )}
                />
            ) : (
                <View style={styles.searchSuggestions}>
                    {/* Recent Searches */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Searches</Text>
                            <TouchableOpacity>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.tagsContainer}>
                            {recentSearches.map((term, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.tag}
                                    onPress={() => handleSearchPress(term)}
                                >
                                    <MaterialCommunityIcons
                                        name="history"
                                        size={16}
                                        color={COLORS.textSecondary}
                                    />
                                    <Text style={styles.tagText}>{term}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Trending Searches */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Trending Searches</Text>
                        <View style={styles.tagsContainer}>
                            {trendingSearches.map((term, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.tag, styles.trendingTag]}
                                    onPress={() => handleSearchPress(term)}
                                >
                                    <MaterialCommunityIcons
                                        name="trending-up"
                                        size={16}
                                        color={COLORS.secondary}
                                    />
                                    <Text style={[styles.tagText, styles.trendingText]}>{term}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Popular Categories */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Popular Categories</Text>
                        <View style={styles.categoriesGrid}>
                            {CATEGORIES.slice(0, 8).map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[styles.categoryItem, { backgroundColor: category.color }]}
                                    onPress={() => navigation.navigate('Category', { category })}
                                >
                                    <Text style={styles.categoryName} numberOfLines={2}>
                                        {category.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
        marginLeft: 10,
    },
    resultGrid: {
        padding: 8,
    },
    productWrapper: {
        flex: 1,
        padding: 8,
        maxWidth: '50%',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    searchSuggestions: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    clearText: {
        fontSize: 13,
        color: COLORS.secondary,
        fontWeight: '600',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        marginBottom: 10,
    },
    trendingTag: {
        backgroundColor: '#E8F5E9',
    },
    tagText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 6,
    },
    trendingText: {
        color: COLORS.secondary,
        fontWeight: '500',
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
    categoryItem: {
        width: '23%',
        aspectRatio: 1,
        borderRadius: 12,
        padding: 8,
        marginRight: '2%',
        marginBottom: 8,
        justifyContent: 'flex-end',
    },
    categoryName: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.text,
        lineHeight: 14,
    },
});

export default SearchScreen;
