import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import {
    setCurrentLocation,
    setSelectedAddress,
    setLocationEnabled,
    setLoading,
    setSavedAddresses,
} from '../store/slices/locationSlice';
import { UserService } from '../services';

const LocationScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const { selectedAddress, savedAddresses, isLoading } = useSelector(
        (state) => state.location
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);

    // Fetch saved addresses from backend on mount
    useEffect(() => {
        fetchSavedAddresses();
    }, []);

    const fetchSavedAddresses = async () => {
        setIsFetchingAddresses(true);
        try {
            const profile = await UserService.getProfile();
            if (profile?.addresses && profile.addresses.length > 0) {
                const formattedAddresses = profile.addresses.map((addr, index) => ({
                    id: `saved-${index}`,
                    type: addr.type,
                    address: addr.address,
                    city: addr.city,
                    pincode: addr.pincode,
                    isDefault: addr.isDefault,
                    latitude: addr.latitude,
                    longitude: addr.longitude,
                }));
                dispatch(setSavedAddresses(formattedAddresses));

                // Select default address if none selected
                const defaultAddr = formattedAddresses.find(a => a.isDefault);
                if (defaultAddr && !selectedAddress) {
                    dispatch(setSelectedAddress(defaultAddr));
                }
            }
        } catch (error) {
            console.log('Failed to fetch addresses:', error);
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    const handleEnableLocation = async () => {
        dispatch(setLoading(true));
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location permission is required to use this feature. Please enable it in settings.',
                    [{ text: 'OK' }]
                );
                dispatch(setLoading(false));
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Reverse geocode to get address
            const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });

            if (address) {
                const addressText = `${address.street || ''} ${address.name || ''}`.trim() || 'Current Location';
                const city = address.city || address.subregion || '';
                const pincode = address.postalCode || '';

                // Save to backend with lat/lng
                try {
                    await UserService.addAddress({
                        type: 'Home',
                        address: addressText,
                        city,
                        pincode,
                        isDefault: true,
                        latitude,
                        longitude,
                    });
                } catch (e) {
                    // Continue even if save fails
                }

                const formattedAddress = {
                    id: 'current',
                    type: 'Current Location',
                    address: addressText,
                    city,
                    pincode,
                    isDefault: false,
                    latitude,
                    longitude,
                    coords: { latitude, longitude },
                };

                dispatch(setCurrentLocation(formattedAddress));
                dispatch(setSelectedAddress(formattedAddress));
                dispatch(setLocationEnabled(true));

                // Navigate to Main (Categories tab) after location is set
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to get your location. Please try again.');
            console.error('Location error:', error);
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleSelectAddress = (address) => {
        dispatch(setSelectedAddress(address));
        navigation.goBack();
    };

    const handleSearchSubmit = async () => {
        if (!searchQuery.trim()) return;

        dispatch(setLoading(true));
        try {
            // Geocode the search text to get lat/lng
            const results = await Location.geocodeAsync(searchQuery.trim());
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];

                // Reverse geocode to get full address details
                const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
                const addressText = address
                    ? [address.name, address.street, address.district].filter(Boolean).join(', ')
                    : searchQuery.trim();
                const city = address?.city || address?.subregion || '';
                const pincode = address?.postalCode || '';

                // Save to backend with lat/lng
                try {
                    const response = await UserService.addAddress({
                        type: 'Other',
                        address: addressText,
                        city,
                        pincode,
                        isDefault: true,
                        latitude,
                        longitude,
                    });

                    if (response?.addresses) {
                        // Refresh saved addresses
                        await fetchSavedAddresses();
                    }
                } catch (e) {
                    // Fallback: navigate to AddAddress screen
                    navigation.navigate('AddAddress', { searchQuery: searchQuery.trim() });
                    return;
                }

                const formattedAddress = {
                    id: `search-${Date.now()}`,
                    type: 'Other',
                    address: addressText,
                    city,
                    pincode,
                    isDefault: true,
                    latitude,
                    longitude,
                    coords: { latitude, longitude },
                };

                dispatch(setSelectedAddress(formattedAddress));
                setSearchQuery('');
                Alert.alert('Address Saved', `${addressText}, ${city} has been saved with coordinates.`);
            } else {
                // Fallback to AddAddress screen for manual entry
                navigation.navigate('AddAddress', { searchQuery: searchQuery.trim() });
            }
        } catch (error) {
            navigation.navigate('AddAddress', { searchQuery: searchQuery.trim() });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleAddNewAddress = () => {
        navigation.navigate('AddAddress');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <MaterialCommunityIcons
                        name="chevron-left"
                        size={28}
                        color={COLORS.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Location</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={22}
                        color={COLORS.textSecondary}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search a new address"
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialCommunityIcons
                                name="close-circle"
                                size={20}
                                color={COLORS.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Use Current Location */}
                <View style={styles.currentLocationCard}>
                    <View style={styles.currentLocationLeft}>
                        <View style={styles.gpsIconContainer}>
                            <MaterialCommunityIcons
                                name="crosshairs-gps"
                                size={22}
                                color="#E91E63"
                            />
                        </View>
                        <View style={styles.currentLocationTexts}>
                            <Text style={styles.currentLocationTitle}>
                                Use My Current Location
                            </Text>
                            <Text style={styles.currentLocationSubtitle}>
                                Enable your current location for better services
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.enableButton}
                        onPress={handleEnableLocation}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#E91E63" />
                        ) : (
                            <Text style={styles.enableButtonText}>Enable</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Saved Addresses */}
                <View style={styles.savedSection}>
                    <Text style={styles.sectionTitle}>Saved Addresses</Text>

                    {isFetchingAddresses ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={COLORS.secondary} />
                        </View>
                    ) : savedAddresses.length > 0 ? (
                        savedAddresses.map((address) => (
                            <TouchableOpacity
                                key={address.id}
                                style={[
                                    styles.addressCard,
                                    selectedAddress?.id === address.id && styles.addressCardSelected,
                                ]}
                                onPress={() => handleSelectAddress(address)}
                            >
                                <View style={styles.addressIconContainer}>
                                    <MaterialCommunityIcons
                                        name={
                                            address.type?.toLowerCase() === 'home'
                                                ? 'home'
                                                : address.type?.toLowerCase() === 'office'
                                                    ? 'office-building'
                                                    : 'map-marker'
                                        }
                                        size={20}
                                        color={selectedAddress?.id === address.id ? '#E91E63' : COLORS.textSecondary}
                                    />
                                </View>
                                <View style={styles.addressDetails}>
                                    <View style={styles.addressTitleRow}>
                                        <Text style={styles.addressType}>{address.type}</Text>
                                        {address.isDefault && (
                                            <View style={styles.defaultBadge}>
                                                <Text style={styles.defaultBadgeText}>Default</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.addressText} numberOfLines={2}>
                                        {address.address}, {address.city} - {address.pincode}
                                    </Text>
                                </View>
                                {selectedAddress?.id === address.id && (
                                    <MaterialCommunityIcons
                                        name="check-circle"
                                        size={22}
                                        color="#E91E63"
                                    />
                                )}
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noAddressText}>No saved addresses yet</Text>
                    )}
                </View>

                {/* Add New Address */}
                <TouchableOpacity style={styles.addAddressButton} onPress={handleAddNewAddress}>
                    <MaterialCommunityIcons
                        name="plus"
                        size={22}
                        color={COLORS.secondary}
                    />
                    <Text style={styles.addAddressText}>Add New Address</Text>
                </TouchableOpacity>

                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.illustration}>
                        <View style={styles.mapBackground}>
                            <View style={styles.cloud1} />
                            <View style={styles.cloud2} />
                            <View style={styles.mapFold}>
                                <View style={styles.mapPinLarge}>
                                    <MaterialCommunityIcons
                                        name="map-marker"
                                        size={40}
                                        color="#E91E63"
                                    />
                                </View>
                            </View>
                            <View style={styles.mapDot1} />
                            <View style={styles.mapDot2} />
                            <View style={styles.mapDot3} />
                        </View>
                    </View>
                </View>

                <View style={styles.bottomPadding} />
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
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginLeft: 8,
    },
    headerRight: {
        width: 36,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
        marginLeft: 10,
        paddingVertical: 0,
    },
    scrollView: {
        flex: 1,
    },
    currentLocationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        padding: 16,
        backgroundColor: '#FCE4EC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F8BBD9',
    },
    currentLocationLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    gpsIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentLocationTexts: {
        marginLeft: 12,
        flex: 1,
    },
    currentLocationTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#E91E63',
    },
    currentLocationSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    enableButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E91E63',
        marginLeft: 12,
        minWidth: 70,
        alignItems: 'center',
    },
    enableButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E91E63',
    },
    savedSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noAddressText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingVertical: 20,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    addressCardSelected: {
        borderColor: '#E91E63',
        backgroundColor: '#FFF8FA',
    },
    addressIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressDetails: {
        flex: 1,
        marginLeft: 12,
    },
    addressTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addressType: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    defaultBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.secondary,
    },
    addressText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    addAddressButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 14,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.secondary,
        borderStyle: 'dashed',
    },
    addAddressText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.secondary,
        marginLeft: 8,
    },
    illustrationContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingHorizontal: 16,
    },
    illustration: {
        width: 200,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapBackground: {
        width: 180,
        height: 120,
        position: 'relative',
    },
    cloud1: {
        position: 'absolute',
        top: 0,
        right: 20,
        width: 40,
        height: 20,
        backgroundColor: '#EDE7F6',
        borderRadius: 10,
    },
    cloud2: {
        position: 'absolute',
        top: 10,
        right: 0,
        width: 30,
        height: 15,
        backgroundColor: '#EDE7F6',
        borderRadius: 8,
    },
    mapFold: {
        width: 160,
        height: 100,
        backgroundColor: '#C8E6C9',
        borderRadius: 8,
        marginTop: 20,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ perspective: 200 }, { rotateX: '-10deg' }],
    },
    mapPinLarge: {
        position: 'absolute',
        top: -20,
    },
    mapDot1: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        width: 12,
        height: 12,
        backgroundColor: '#CE93D8',
        borderRadius: 6,
    },
    mapDot2: {
        position: 'absolute',
        bottom: 40,
        right: 40,
        width: 10,
        height: 10,
        backgroundColor: '#CE93D8',
        borderRadius: 5,
    },
    mapDot3: {
        position: 'absolute',
        bottom: 20,
        right: 60,
        width: 8,
        height: 8,
        backgroundColor: '#FFCC80',
        borderRadius: 4,
    },
    bottomPadding: {
        height: 40,
    },
});

export default LocationScreen;
