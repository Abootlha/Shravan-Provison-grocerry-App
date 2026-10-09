import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native';
import { useSelector } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function WishlistToast() {
    const { lastAddedItem, lastAddedTime } = useSelector((state) => state.wishlist);
    const [visible, setVisible] = useState(false);
    const translateY = useRef(new Animated.Value(100)).current;
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    useEffect(() => {
        if (lastAddedItem && lastAddedTime) {
            setVisible(true);

            // Animate up
            Animated.timing(translateY, {
                toValue: 0,
                duration: 400,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }).start();

            // Auto-hide after 3 seconds
            const timer = setTimeout(() => {
                hideToast();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [lastAddedItem, lastAddedTime]);

    const hideToast = () => {
        Animated.timing(translateY, {
            toValue: 150,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setVisible(false);
        });
    };

    if (!visible || !lastAddedItem) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY }],
                    bottom: insets.bottom + 80, // Above bottom tab bar if any
                },
            ]}
        >
            <View style={styles.toastContent}>
                <View style={styles.leftContent}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                    </View>
                    <View>
                        <Text style={styles.title}>Added to Wishlist</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {lastAddedItem.name}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.viewButton}
                    activeOpacity={0.8}
                    onPress={() => {
                        hideToast();
                        navigation.navigate('Wishlist');
                    }}
                >
                    <Text style={styles.viewButtonText}>View</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#7C3AED" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: '#1E293B',
        borderRadius: 16,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        zIndex: 9999,
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    leftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16, 185, 129, 0.15)', // Translucent green matching dark bg
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    viewButtonText: {
        color: '#7C3AED',
        fontSize: 13,
        fontWeight: '700',
        marginRight: 2,
    },
});
