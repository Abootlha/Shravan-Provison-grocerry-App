import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';
import { COLORS, SHADOWS } from '../constants';
import { setSelectedAddress, addSavedAddress } from '../store/slices/locationSlice';
import { UserService, SettingsService } from '../services';
import MapComponent from '../components/MapComponent';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const AddAddressScreen = ({ navigation, route }) => {
    const dispatch = useDispatch();
    const mapRef = useRef(null);
    const searchQuery = route.params?.searchQuery || '';

    // State
    const [region, setRegion] = useState({
        latitude: 28.6139,
        longitude: 77.2090,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
    });
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [addressDetails, setAddressDetails] = useState({
        address: '',
        city: '',
        pincode: '',
    });
    const [searchText, setSearchText] = useState(searchQuery);
    const [isServiceable, setIsServiceable] = useState(null);
    const [distanceKm, setDistanceKm] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [addressType, setAddressType] = useState('Home');

    // Get user's current location on mount
    useEffect(() => {
        getCurrentLocation();
    }, []);

    const getCurrentLocation = async () => {
        setIsLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;

                const newRegion = {
                    latitude,
                    longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                };

                setRegion(newRegion);
                setSelectedLocation({ latitude, longitude });

                // Get address for this location
                await reverseGeocode(latitude, longitude);

                // Check serviceability
                await checkServiceability(latitude, longitude);
            }
        } catch (error) {
            console.log('Error getting location:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reverseGeocode = async (latitude, longitude) => {
        try {
            const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (address) {
                const formattedAddress = [
                    address.name,
                    address.street,
                    address.district,
                ].filter(Boolean).join(', ');

                setAddressDetails({
                    address: formattedAddress || 'Selected Location',
                    city: address.city || address.subregion || '',
                    pincode: address.postalCode || '',
                });
            }
        } catch (error) {
            console.log('Reverse geocode error:', error);
        }
    };

    const checkServiceability = async (latitude, longitude) => {
        setIsCheckingServiceability(true);
        try {
            const result = await SettingsService.checkServiceability(latitude, longitude);
            setIsServiceable(result.isServiceable);
            setDistanceKm(result.distanceKm);
        } catch (error) {
            console.log('Serviceability check error:', error);
            // Fallback to serviceable if backend is not available
            setIsServiceable(true);
        } finally {
            setIsCheckingServiceability(false);
        }
    };

    const handleMapPress = async (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;

        setSelectedLocation({ latitude, longitude });
        setIsServiceable(null); // Reset while checking

        // Get address for new location
        await reverseGeocode(latitude, longitude);

        // Check serviceability
        await checkServiceability(latitude, longitude);
    };

    const handleRegionChangeComplete = (newRegion) => {
        setRegion(newRegion);
    };

    const handleSearchSubmit = async () => {
        if (!searchText.trim()) return;

        setIsLoading(true);
        try {
            // Geocode the search text
            const results = await Location.geocodeAsync(searchText);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];

                const newRegion = {
                    latitude,
                    longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                };

                setRegion(newRegion);
                setSelectedLocation({ latitude, longitude });

                if (mapRef.current?.animateToRegion) {
                    mapRef.current.animateToRegion(newRegion, 500);
                }

                // Get address details
                await reverseGeocode(latitude, longitude);

                // Check serviceability
                await checkServiceability(latitude, longitude);
            } else {
                Alert.alert('Not Found', 'Could not find the location. Please try a different search.');
            }
        } catch (error) {
            console.log('Geocode error:', error);
            Alert.alert('Error', 'Failed to search location. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCurrentLocationPress = () => {
        getCurrentLocation();
    };

    const handleConfirmLocation = async () => {
        if (!selectedLocation || !isServiceable) return;

        setIsSaving(true);
        try {
            // Save to backend
            const response = await UserService.addAddress({
                type: addressType,
                address: addressDetails.address,
                city: addressDetails.city,
                pincode: addressDetails.pincode,
                isDefault: true,
            });

            if (response?.addresses) {
                const savedAddress = response.addresses[response.addresses.length - 1];
                const formattedAddress = {
                    id: `saved-${response.addresses.length - 1}`,
                    type: savedAddress.type,
                    address: savedAddress.address,
                    city: savedAddress.city,
                    pincode: savedAddress.pincode,
                    isDefault: savedAddress.isDefault,
                    coords: selectedLocation,
                };

                dispatch(addSavedAddress(formattedAddress));
                dispatch(setSelectedAddress(formattedAddress));

                // Navigate to Main screen
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }
        } catch (error) {
            console.error('Failed to save address:', error);
            Alert.alert('Error', 'Failed to save address. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <MaterialCommunityIcons
                        name="chevron-left"
                        size={28}
                        color={COLORS.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Your Location</Text>
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
                        placeholder="Search for apartment, street name..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <MaterialCommunityIcons
                                name="close-circle"
                                size={20}
                                color={COLORS.textSecondary}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Map Component (Platform-specific) */}
            <MapComponent
                region={region}
                selectedLocation={selectedLocation}
                addressDetails={addressDetails}
                isLoading={isLoading}
                onMapPress={handleMapPress}
                onRegionChangeComplete={handleRegionChangeComplete}
                onCurrentLocationPress={handleCurrentLocationPress}
            />

            {/* Bottom Sheet */}
            <View style={styles.bottomSheet}>
                {/* Serviceability Message */}
                {isServiceable !== null && (
                    <View style={[
                        styles.serviceabilityBanner,
                        isServiceable ? styles.serviceableBanner : styles.notServiceableBanner,
                    ]}>
                        <MaterialCommunityIcons
                            name={isServiceable ? 'check-circle' : 'alert-circle'}
                            size={18}
                            color={isServiceable ? COLORS.secondary : '#D32F2F'}
                        />
                        <Text style={[
                            styles.serviceabilityText,
                            isServiceable ? styles.serviceableText : styles.notServiceableText,
                        ]}>
                            {isServiceable
                                ? `Great! We deliver here${distanceKm !== null ? ` (${distanceKm}km away)` : '!'}`
                                : `We are not serviceable at this location. Please select a different location.`
                            }
                        </Text>
                    </View>
                )}

                {/* Address Details */}
                {addressDetails.address && (
                    <View style={styles.addressSection}>
                        <Text style={styles.addressTitle} numberOfLines={1}>
                            {addressDetails.address}
                        </Text>
                        <Text style={styles.addressSubtitle}>
                            {[addressDetails.city, addressDetails.pincode].filter(Boolean).join(' - ')}
                        </Text>
                    </View>
                )}

                {/* Address Type Selection */}
                <View style={styles.typeContainer}>
                    {['Home', 'Office', 'Other'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeButton,
                                addressType === type && styles.typeButtonActive,
                            ]}
                            onPress={() => setAddressType(type)}
                        >
                            <Text style={[
                                styles.typeText,
                                addressType === type && styles.typeTextActive,
                            ]}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        (!isServiceable || isCheckingServiceability || isSaving) && styles.confirmButtonDisabled,
                    ]}
                    onPress={handleConfirmLocation}
                    disabled={!isServiceable || isCheckingServiceability || isSaving}
                >
                    {isSaving || isCheckingServiceability ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Text style={styles.confirmButtonText}>Confirm Location</Text>
                    )}
                </TouchableOpacity>
            </View>
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
        zIndex: 10,
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
        paddingVertical: 8,
        backgroundColor: COLORS.white,
        zIndex: 10,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
        marginLeft: 10,
        paddingVertical: 0,
    },
    bottomSheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        ...SHADOWS.dark,
    },
    serviceabilityBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        marginBottom: 12,
        gap: 10,
    },
    serviceableBanner: {
        backgroundColor: '#E8F5E9',
    },
    notServiceableBanner: {
        backgroundColor: '#FFEBEE',
    },
    serviceabilityText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    serviceableText: {
        color: COLORS.secondary,
    },
    notServiceableText: {
        color: '#D32F2F',
    },
    addressSection: {
        marginBottom: 12,
    },
    addressTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    addressSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    typeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
    },
    typeButtonActive: {
        backgroundColor: COLORS.secondary,
    },
    typeText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    typeTextActive: {
        color: COLORS.white,
    },
    confirmButton: {
        backgroundColor: COLORS.secondary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#CCC',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.white,
    },
});

export default AddAddressScreen;
