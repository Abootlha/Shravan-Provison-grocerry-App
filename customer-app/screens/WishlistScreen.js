/**
 * WishlistScreen — saved products as a 2-column ProductCard grid (FlashList) on the canvas,
 * under a plain title; an EmptyState (cause + one action) when nothing is saved yet.
 * Motion: the body arrives with the screen-enter beat, cards stagger in, and list ↔ empty
 * crossfades (ContentSwap) when the last item is removed. Colours all come from primitives.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { AnimatedListItem, AnimatedScreen, ContentSwap, IconButton, Screen, Text } from '../components/ui';
import { space } from '../constants/theme';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import FloatingCartBar from '../components/FloatingCartBar';
import { useTranslation } from '../hooks/useTranslation';

const GRID_CARD = { width: '100%', marginRight: 0 };

const WishlistScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { isHi } = useTranslation();
    const wishlistItems = useSelector((state) => state.wishlist?.items || []);
    const count = wishlistItems.length;

    const openProduct = useCallback((product) => navigation.navigate('ProductDetail', { product }), [navigation]);
    const renderItem = useCallback(
        ({ item, index }) => (
            <AnimatedListItem index={index} style={styles.cell}>
                <ProductCard product={item} style={GRID_CARD} onPress={() => openProduct(item)} />
            </AnimatedListItem>
        ),
        [openProduct]
    );

    return (
        <Screen>
            <AnimatedScreen>
            <View style={styles.header}>
                <IconButton name="arrow-left" variant="floating" onPress={navigation.goBack} accessibilityLabel="Go back" />
                <View style={styles.titles}>
                    <Text variant="h1" numberOfLines={1} accessibilityRole="header">
                        {isHi ? 'विशलिस्ट' : 'Wishlist'}
                    </Text>
                    {count > 0 ? (
                        <Text variant="caption" color="muted">
                            {isHi ? `${count} सामान सेव किए` : `${count} ${count === 1 ? 'item' : 'items'} saved`}
                        </Text>
                    ) : null}
                </View>
            </View>

            <ContentSwap stateKey={count === 0 ? 'empty' : 'data'} style={styles.fill}>
            {count === 0 ? (
                <EmptyState
                    type="favorites"
                    title={isHi ? 'आपकी विशलिस्ट खाली है' : 'Your wishlist is empty'}
                    onAction={() => navigation.navigate('Main', { screen: 'Home' })}
                />
            ) : (
                <FlashList
                    data={wishlistItems}
                    numColumns={2}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{
                        paddingHorizontal: space.md - space.xs,
                        paddingTop: space.sm,
                        paddingBottom: insets.bottom + 120,
                    }}
                    showsVerticalScrollIndicator={false}
                />
            )}
            </ContentSwap>
            </AnimatedScreen>
            <FloatingCartBar onPress={() => navigation.navigate('Main', { screen: 'Cart' })} bottomOffset={insets.bottom + space.lg} />
        </Screen>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        paddingBottom: space.md,
    },
    titles: { flex: 1 },
    cell: { flex: 1, paddingHorizontal: space.xs },
    fill: { flex: 1 },
});

export default WishlistScreen;
