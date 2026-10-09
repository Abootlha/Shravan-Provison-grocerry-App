import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, StatusBar, ImageBackground } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants';
import { ProductCard } from '../components';

const WishlistScreen = () => {
    const navigation = useNavigation();
    const wishlistItems = useSelector((state) => state.wishlist?.items || []);

    const insets = useSafeAreaInsets();

    const renderHeader = () => (
        <View style={styles.heroHeader}>
            <LinearGradient
                colors={['#7C3AED', '#6C3CF4', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroGradient, { paddingTop: insets.top + 12 }]}
            >
                {/* Abstract background icons */}
                <MaterialCommunityIcons name="heart-multiple-outline" size={160} color="rgba(255,255,255,0.06)" style={styles.bgIcon1} />
                <MaterialCommunityIcons name="shopping-outline" size={120} color="rgba(255,255,255,0.04)" style={styles.bgIcon2} />
                
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={26} color="#FFF" />
                    </TouchableOpacity>
                    <View style={{ width: 26 }} />
                </View>

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>My Wishlist</Text>
                    <Text style={styles.headerSubtitle}>
                        {wishlistItems.length} {wishlistItems.length === 1 ? 'Item' : 'Items'} saved
                    </Text>
                </View>
            </LinearGradient>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="heart-broken" size={80} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
            <Text style={styles.emptySubtitle}>Explore our products and like them to save them here for later!</Text>
            <TouchableOpacity style={styles.exploreButton} onPress={() => navigation.navigate('Main', { screen: 'Home' })}>
                <Text style={styles.exploreButtonText}>Explore Products</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            {wishlistItems.length === 0 ? (
                renderEmptyState()
            ) : (
                <FlatList
                    data={wishlistItems}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.cardContainer}>
                            <ProductCard 
                                product={item} 
                                style={{ width: '100%' }}
                                onPress={() => navigation.navigate('ProductDetail', { product: item })} 
                            />
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    heroHeader: {
        width: '100%',
        height: 190,
    },
    heroGradient: {
        flex: 1,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    bgIcon1: {
        position: 'absolute',
        right: -30,
        top: -10,
        transform: [{ rotate: '-15deg' }],
    },
    bgIcon2: {
        position: 'absolute',
        left: -20,
        bottom: -20,
        transform: [{ rotate: '15deg' }],
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 1,
    },
    backButton: {
        padding: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
    },
    headerTitleContainer: {
        marginTop: 20,
        paddingHorizontal: 24,
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 6,
        fontWeight: '600',
    },
    listContainer: {
        padding: 12,
        paddingBottom: 100,
    },
    row: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardContainer: {
        width: '48%',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 24,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    exploreButton: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 24,
    },
    exploreButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: '700',
    },
});

export default WishlistScreen;
