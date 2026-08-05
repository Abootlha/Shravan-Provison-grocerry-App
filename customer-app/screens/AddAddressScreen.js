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
    ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft01Icon,
    Search01Icon,
    Location01Icon,
    Alert01Icon,
    CheckmarkCircle01Icon,
    Home01Icon,
    Briefcase01Icon,
    Building01Icon,
    Cancel01Icon,
} from 'hugeicons-react-native';
import { COLORS } from '../constants';
import { setSelectedAddress, addSavedAddress } from '../store/slices/locationSlice';
import { UserService, SettingsService } from '../services';
import { geocodeAddress, reverseGeocode as mapplsReverseGeocode, searchPlaces } from '../services';
import MapComponent from '../components/MapComponent';
import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Store Center Location for fallback distance calculation
const STORE_LOCATION = {
    latitude: 26.7588,
    longitude: 83.3700,
    maxRadiusKm: 10.0,
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
};

const AddAddressScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const mapRef = useRef(null);
    const searchQuery = route.params?.searchQuery || '';
    const editAddress = route.params?.editAddress || null;
    const addressIndex = route.params?.addressIndex ?? null;
    const { isHi } = useTranslation();

    // State
    const [region, setRegion] = useState({
        latitude: editAddress?.latitude || 26.6926,
        longitude: editAddress?.longitude || 83.4687,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
    });
    const [selectedLocation, setSelectedLocation] = useState({
        latitude: editAddress?.latitude || 26.6926,
        longitude: editAddress?.longitude || 83.4687,
    });
    const [addressDetails, setAddressDetails] = useState({
        address: editAddress?.address || 'Chavri Road, Gorakhpur',
        city: editAddress?.city || 'Gorakhpur',
        pincode: editAddress?.pincode || '273202',
    });
    const [searchText, setSearchText] = useState(searchQuery);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingLoading, setIsSearchingLoading] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);
    const [distanceKm, setDistanceKm] = useState(3.2);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [addressType, setAddressType] = useState(editAddress?.type || 'Home');

    // Live search debouncing effect for Zepto-style address suggestions
    useEffect(() => {
        if (!searchText || searchText.trim().length < 2) {
            setSuggestions([]);
            setIsSearching(false);
            setIsSearchingLoading(false);
            return;
        }

        setIsSearching(true);
        setIsSearchingLoading(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchPlaces(searchText.trim(), selectedLocation);
                setSuggestions(results || []);
            } catch (err) {
                console.log('Search places error:', err);
                setSuggestions([]);
            } finally {
                setIsSearchingLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchText]);

    // Get user's current location on mount (unless editing existing location)
    useEffect(() => {
        if (editAddress) {
            if (editAddress.latitude && editAddress.longitude) {
                checkServiceability(editAddress.latitude, editAddress.longitude);
            } else {
                getCurrentLocation();
            }
        } else {
            getCurrentLocation();
        }
    }, []);

    const getCurrentLocation = async () => {
        setIsLoading(true);
        try {
            let latitude;
            let longitude;

            if (Platform.OS === 'web') {
                const position = await new Promise((resolve, reject) => {
                    if (!navigator?.geolocation) {
                        reject(new Error('Geolocation is not available'));
                        return;
                    }

                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 15000,
                    });
                });
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;
            } else {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    throw new Error('Location permission not granted');
                }
                const location = await Location.getCurrentPositionAsync({});
                latitude = location.coords.latitude;
                longitude = location.coords.longitude;
            }

            const newRegion = {
                latitude,
                longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };

            setRegion(newRegion);
            setSelectedLocation({ latitude, longitude });

            await reverseGeocode(latitude, longitude);
            await checkServiceability(latitude, longitude);
        } catch (error) {
            console.log('Error getting location:', error);
            // Fallback default coordinates
            const fallbackLat = 26.6926;
            const fallbackLng = 83.4687;
            setSelectedLocation({ latitude: fallbackLat, longitude: fallbackLng });
            await reverseGeocode(fallbackLat, fallbackLng);
            await checkServiceability(fallbackLat, fallbackLng);
        } finally {
            setIsLoading(false);
        }
    };

    const reverseGeocode = async (latitude, longitude) => {
        try {
            let addressStr = '';
            let cityStr = 'Gorakhpur';
            let pincodeStr = '273010';

            // 1. Try Mappls reverse geocode
            try {
                const address = await mapplsReverseGeocode(latitude, longitude);
                if (address && (address.formattedAddress || address.city)) {
                    addressStr = address.formattedAddress || address.address || '';
                    cityStr = address.city || address.district || 'Gorakhpur';
                    pincodeStr = address.pincode || '273010';
                }
            } catch (e) {
                console.log('Mappls reverse geocode failed:', e);
            }

            // 2. Fallback to Expo Location reverseGeocodeAsync
            if (!addressStr) {
                try {
                    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
                    if (results && results.length > 0) {
                        const fallbackAddress = results[0];
                        const parts = [
                            fallbackAddress.name,
                            fallbackAddress.street,
                            fallbackAddress.subregion || fallbackAddress.district,
                            fallbackAddress.city,
                        ].filter(
                            (p) => p && typeof p === 'string' && !p.toLowerCase().includes('undefined')
                        );

                        addressStr = parts.join(', ');
                        cityStr = fallbackAddress.city || fallbackAddress.subregion || 'Gorakhpur';
                        pincodeStr = fallbackAddress.postalCode || '273010';
                    }
                } catch (e) {
                    console.log('Expo reverse geocode failed:', e);
                }
            }

            // 3. Final clean fallback formatting
            if (!addressStr || addressStr.toLowerCase().includes('undefined')) {
                addressStr = 'Medical Road, Gorakhpur, Uttar Pradesh';
            }

            setAddressDetails({
                address: addressStr,
                city: cityStr,
                pincode: pincodeStr,
            });
        } catch (error) {
            console.log('Reverse geocode error:', error);
            setAddressDetails({
                address: 'Medical Road, Gorakhpur, Uttar Pradesh',
                city: 'Gorakhpur',
                pincode: '273010',
            });
        }
    };

    const checkServiceability = (latitude, longitude) => {
        const dist = calculateDistanceKm(
            STORE_LOCATION.latitude,
            STORE_LOCATION.longitude,
            latitude,
            longitude
        );
        setDistanceKm(dist);
        setIsServiceable(dist <= STORE_LOCATION.maxRadiusKm);
    };

    const handleMapPress = async (event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;

        setSelectedLocation({ latitude, longitude });
        await reverseGeocode(latitude, longitude);
        await checkServiceability(latitude, longitude);
    };

    const handleRegionChangeComplete = (newRegion) => {
        setRegion(newRegion);
    };

    const handleSelectSuggestion = async (item) => {
        setIsSearching(false);
        setSuggestions([]);
        setSearchText(item.name || item.formattedAddress);

        let lat = item.latitude;
        let lng = item.longitude;

        if (lat === null || lng === null) {
            setIsLoading(true);
            try {
                const geocoded = await geocodeAddress(item.formattedAddress || item.name);
                if (geocoded?.latitude && geocoded?.longitude) {
                    lat = geocoded.latitude;
                    lng = geocoded.longitude;
                }
            } catch (e) {
                console.log('Geocoding suggestion error:', e);
            } finally {
                setIsLoading(false);
            }
        }

        if (lat && lng) {
            const newRegion = {
                latitude: lat,
                longitude: lng,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };

            setRegion(newRegion);
            setSelectedLocation({ latitude: lat, longitude: lng });

            setAddressDetails({
                address: item.formattedAddress || item.name,
                city: item.city || 'Gorakhpur',
                pincode: item.pincode || '273202',
            });

            if (mapRef.current?.animateToRegion) {
                mapRef.current.animateToRegion(newRegion, 500);
            }

            checkServiceability(lat, lng);
        }
    };

    const handleClearSearch = () => {
        setSearchText('');
        setSuggestions([]);
        setIsSearching(false);
    };

    const handleSearchSubmit = async () => {
        if (!searchText.trim()) return;

        setIsLoading(true);
        try {
            const placeResults = await searchPlaces(searchText.trim());
            const mapplsResult = placeResults[0] || (await geocodeAddress(searchText.trim()));

            if (mapplsResult) {
                const latitude = mapplsResult.latitude;
                const longitude = mapplsResult.longitude;

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

                setAddressDetails({
                    address: mapplsResult.formattedAddress || searchText.trim(),
                    city: mapplsResult.city || mapplsResult.district || 'Gorakhpur',
                    pincode: mapplsResult.pincode || '273202',
                });

                await checkServiceability(latitude, longitude);
            } else {
                Alert.alert(
                    isHi ? 'स्थान नहीं मिला' : 'Not Found',
                    isHi ? 'स्थान नहीं खोजा जा सका।' : 'Could not find the location.'
                );
            }
        } catch (error) {
            console.log('Geocode error:', error);
        } finally {
            setIsLoading(false);
            setIsSearching(false);
        }
    };

    const handleCurrentLocationPress = () => {
        getCurrentLocation();
    };

    const handleConfirmLocation = async () => {
        if (!selectedLocation || !isServiceable) return;

        setIsSaving(true);
        try {
            const isEditing = addressIndex !== null && addressIndex !== undefined;

            if (isEditing) {
                await UserService.updateAddress(addressIndex, {
                    type: addressType,
                    address: addressDetails.address,
                    city: addressDetails.city,
                    pincode: addressDetails.pincode,
                    isDefault: editAddress?.isDefault ?? true,
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });
            } else {
                await UserService.addAddress({
                    type: addressType,
                    address: addressDetails.address,
                    city: addressDetails.city,
                    pincode: addressDetails.pincode,
                    isDefault: true,
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });
            }

            const formattedAddress = {
                id: editAddress?.id || `saved-${Date.now()}`,
                type: addressType,
                address: addressDetails.address,
                city: addressDetails.city,
                pincode: addressDetails.pincode,
                isDefault: editAddress?.isDefault ?? true,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                coords: selectedLocation,
            };

            dispatch(setSelectedAddress(formattedAddress));

            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }
        } catch (error) {
            console.error('Failed to save address:', error);
            const fallbackAddress = {
                id: `loc-${Date.now()}`,
                type: addressType,
                address: addressDetails.address,
                city: addressDetails.city || 'Gorakhpur',
                pincode: addressDetails.pincode || '273202',
                isDefault: true,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
            };
            dispatch(setSelectedAddress(fallbackAddress));
            navigation.goBack();
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    const currentLat = selectedLocation?.latitude || region.latitude || 26.6926;
    const currentLng = selectedLocation?.longitude || region.longitude || 83.4687;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#EAE0FF" translucent />

            {/* 1 & 2. HEADER & SEARCH BAR WITH LIGHT GLOWING PURPLE GRADIENT (HOMESCREEN MATCH) */}
            <LinearGradient
                colors={['#EAE0FF', '#F5EFFF', '#FAFAFC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.gradientHeaderWrapper, { paddingTop: insets.top + 6 }]}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.whiteBackButton} onPress={handleBack} activeOpacity={0.8}>
                        <ArrowLeft01Icon size={20} color="#111827" strokeWidth={2.2} />
                    </TouchableOpacity>
                    <Text style={styles.lightHeaderTitle}>
                        {editAddress ? (isHi ? 'पता संपादित करें' : 'Edit Address') : (isHi ? 'स्थान चुनें' : 'Select Your Location')}
                    </Text>
                </View>

                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search01Icon size={18} color="#6B7280" strokeWidth={2} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={
                                isHi
                                    ? 'अपार्टमेंट, सड़क का नाम खोजें...'
                                    : 'Search for apartment, street name...'
                            }
                            placeholderTextColor="#9CA3AF"
                            value={searchText}
                            onChangeText={setSearchText}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity
                                onPress={handleClearSearch}
                                style={styles.clearSearchBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Cancel01Icon size={18} color="#6B7280" strokeWidth={2} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </LinearGradient>

            {/* 3. DYNAMIC SEARCH SUGGESTIONS OVERLAY (ZEPTO UI PARITY) OR MAP & BOTTOM SHEET */}
            {isSearching ? (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsTitleRow}>
                        <Text style={styles.suggestionsSectionHeader}>
                            {isHi ? 'खोज परिणाम' : 'SEARCH RESULTS'}
                        </Text>
                        {isSearchingLoading && (
                            <ActivityIndicator size="small" color="#7C3AED" style={{ marginLeft: 8 }} />
                        )}
                    </View>

                    {suggestions.length === 0 && !isSearchingLoading ? (
                        <View style={styles.emptySuggestionsBox}>
                            <Text style={styles.emptySuggestionsText}>
                                {isHi
                                    ? 'कोई स्थान नहीं मिला। कृपया दूसरा कीवर्ड खोजें।'
                                    : 'No matching location found.'}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.suggestionsScrollView}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {suggestions.map((item, index) => {
                                const dist = item.distanceKm != null
                                    ? item.distanceKm
                                    : (item.latitude && item.longitude
                                        ? calculateDistanceKm(
                                              STORE_LOCATION.latitude,
                                              STORE_LOCATION.longitude,
                                              item.latitude,
                                              item.longitude
                                          )
                                        : null);

                                const isDeliverable = dist === null || dist <= STORE_LOCATION.maxRadiusKm;

                                return (
                                    <TouchableOpacity
                                        key={item.placeId || index}
                                        disabled={!isDeliverable}
                                        style={[
                                            styles.zeptoSuggestionCard,
                                            !isDeliverable && styles.zeptoSuggestionCardDisabled,
                                        ]}
                                        onPress={() => isDeliverable && handleSelectSuggestion(item)}
                                        activeOpacity={isDeliverable ? 0.75 : 1}
                                    >
                                        <View style={[styles.greenLocationBadge, !isDeliverable && styles.redLocationBadge]}>
                                            <Location01Icon
                                                size={18}
                                                color={isDeliverable ? '#10B981' : '#EF4444'}
                                                strokeWidth={2.2}
                                            />
                                        </View>

                                        <View style={styles.zeptoSuggestionTextGroup}>
                                            <Text
                                                style={[
                                                    styles.zeptoSuggestionTitle,
                                                    !isDeliverable && styles.disabledText,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.name}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.zeptoSuggestionAddress,
                                                    !isDeliverable && styles.disabledTextSecondary,
                                                ]}
                                            >
                                                {item.formattedAddress}
                                            </Text>
                                            {dist !== null && (
                                                <View style={styles.distanceBadgeRow}>
                                                    <Text
                                                        style={[
                                                            styles.zeptoDistanceTag,
                                                            !isDeliverable && styles.zeptoDistanceTagRed,
                                                        ]}
                                                    >
                                                        📍 {dist} km {isHi ? 'स्टोर से' : 'from store'}
                                                        {!isDeliverable && (isHi ? ' (सीमा 10 km)' : ' (Max 10 km)')}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {!isDeliverable && (
                                            <View style={styles.zeptoNotDeliverablePill}>
                                                <Text style={styles.zeptoNotDeliverableText}>
                                                    {isHi ? 'डिलीवरी अनुपलब्ध' : 'Not Deliverable'}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            ) : (
                <>
                    {/* MAP COMPONENT */}
                    <View style={styles.mapContainer}>
                        <MapComponent
                            region={region}
                            selectedLocation={selectedLocation}
                            addressDetails={addressDetails}
                            isLoading={isLoading}
                            onMapPress={handleMapPress}
                            onRegionChangeComplete={handleRegionChangeComplete}
                            onCurrentLocationPress={handleCurrentLocationPress}
                        />
                    </View>

                    {/* BOTTOM SHEET CONTENT */}
            <View style={styles.bottomSheet}>
                {/* A. SELECTED LOCATION CARD */}
                <View
                    style={[
                        styles.selectedLocationCard,
                        !isServiceable && styles.selectedLocationCardRed,
                    ]}
                >
                    <View
                        style={[
                            styles.locationIconBadge,
                            !isServiceable
                                ? styles.locationIconBadgeRed
                                : styles.locationIconBadgeGreen,
                        ]}
                    >
                        <Location01Icon
                            size={20}
                            color={isServiceable ? '#059669' : '#EF4444'}
                            strokeWidth={2.2}
                        />
                    </View>

                    <View style={styles.selectedLocationTextGroup}>
                        <Text style={styles.selectedLocationHeading}>
                            {isHi ? 'चुना गया स्थान' : 'Selected Location'}
                        </Text>
                        <Text style={styles.selectedLocationSubtext} numberOfLines={2}>
                            {addressDetails.address && !addressDetails.address.toLowerCase().includes('undefined')
                                ? addressDetails.address
                                : 'Medical Road, Gorakhpur, Uttar Pradesh - 273010'}
                        </Text>

                        {/* LIVE LATITUDE AND LONGITUDE DISPLAY */}
                        <Text
                            style={[
                                styles.coordsText,
                                !isServiceable && styles.coordsTextRed,
                            ]}
                        >
                            📍 Lat: {currentLat.toFixed(4)}, Lng: {currentLng.toFixed(4)}
                        </Text>
                    </View>
                </View>

                {/* B. PROMINENT SERVICEABILITY WARNING BANNER (RED ALERT BOX IF OUT OF RANGE) */}
                {isServiceable === false ? (
                    <View style={styles.notServiceableBanner}>
                        <Alert01Icon size={20} color="#EF4444" strokeWidth={2.2} style={{ marginTop: 2 }} />
                        <View style={styles.bannerTextGroup}>
                            <Text style={styles.notServiceableText}>
                                {isHi
                                    ? `हम इस स्थान पर डिलीवरी उपलब्ध नहीं करा सकते। (स्टोर से ${distanceKm !== null ? distanceKm : '12.2'} किमी दूर — अधिकतम सीमा: ${STORE_LOCATION.maxRadiusKm} किमी)`
                                    : `We are not serviceable at this location. (${distanceKm !== null ? distanceKm : '12.2'} km away from store — Max limit: ${STORE_LOCATION.maxRadiusKm} km)`}
                            </Text>
                            <Text style={styles.distanceSubtext}>
                                {isHi
                                    ? `कृपया स्टोर सीमा (${STORE_LOCATION.maxRadiusKm} किमी) के भीतर कोई अन्य स्थान चुनें।`
                                    : `Please select a different location within ${STORE_LOCATION.maxRadiusKm} km radius.`}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.serviceableBanner}>
                        <CheckmarkCircle01Icon size={18} color="#059669" strokeWidth={2.2} />
                        <View style={styles.bannerTextGroup}>
                            <Text style={styles.serviceableText}>
                                {isHi
                                    ? `स्थान डिलीवरी योग्य है (स्टोर से ${distanceKm !== null ? distanceKm : '3.2'} किमी दूर • 10 मिनट डिलीवरी)`
                                    : `Delivery Available (${distanceKm !== null ? distanceKm : '3.2'} km away from store • 10 min delivery)`}
                            </Text>
                        </View>
                    </View>
                )}

                {/* B. ADDRESS TAG SELECTION ROW */}
                <View style={styles.typeContainer}>
                    <TouchableOpacity
                        style={[
                            styles.typeButton,
                            addressType === 'Home' && styles.typeButtonActiveHome,
                        ]}
                        onPress={() => setAddressType('Home')}
                        activeOpacity={0.8}
                    >
                        <Home01Icon
                            size={14}
                            color={addressType === 'Home' ? '#FFFFFF' : '#374151'}
                            strokeWidth={2}
                        />
                        <Text
                            style={[
                                styles.typeText,
                                addressType === 'Home' && styles.typeTextActive,
                            ]}
                        >
                            {isHi ? 'घर' : 'Home'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.typeButton,
                            addressType === 'Office' && styles.typeButtonActiveOffice,
                        ]}
                        onPress={() => setAddressType('Office')}
                        activeOpacity={0.8}
                    >
                        <Briefcase01Icon
                            size={14}
                            color={addressType === 'Office' ? '#FFFFFF' : '#374151'}
                            strokeWidth={2}
                        />
                        <Text
                            style={[
                                styles.typeText,
                                addressType === 'Office' && styles.typeTextActive,
                            ]}
                        >
                            {isHi ? 'कार्यालय' : 'Office'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.typeButton,
                            addressType === 'Other' && styles.typeButtonActiveOther,
                        ]}
                        onPress={() => setAddressType('Other')}
                        activeOpacity={0.8}
                    >
                        <Building01Icon
                            size={14}
                            color={addressType === 'Other' ? '#FFFFFF' : '#374151'}
                            strokeWidth={2}
                        />
                        <Text
                            style={[
                                styles.typeText,
                                addressType === 'Other' && styles.typeTextActive,
                            ]}
                        >
                            {isHi ? 'अन्य' : 'Other'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* D. CONFIRM LOCATION BUTTON WITH ROYAL PURPLE GRADIENT */}
                <TouchableOpacity
                    style={styles.confirmTouchable}
                    onPress={handleConfirmLocation}
                    disabled={!isServiceable || isCheckingServiceability || isSaving}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={
                            !isServiceable || isCheckingServiceability || isSaving
                                ? ['#9CA3AF', '#D1D5DB']
                                : ['#6D28D9', '#7C3AED', '#8B5CF6']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmGradientButton}
                    >
                        {isSaving || isCheckingServiceability ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.confirmButtonText}>
                                {isHi ? 'स्थान की पुष्टि करें' : 'Confirm Location'}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </>
    )}
</View>
    );
};

export default AddAddressScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFC',
    },
    gradientHeaderWrapper: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingBottom: 10,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 6,
    },
    whiteBackButton: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    lightHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginTop: 6,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#111827',
        marginLeft: 8,
        paddingVertical: 0,
    },
    clearSearchBtn: {
        padding: 4,
        marginLeft: 6,
    },
    // ZEPTO SUGGESTIONS OVERLAY STYLES
    suggestionsContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    suggestionsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    suggestionsSectionHeader: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#7C3AED',
        letterSpacing: 0.5,
    },
    emptySuggestionsBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    emptySuggestionsText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    suggestionsScrollView: {
        flex: 1,
    },
    zeptoSuggestionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    suggestionBorderBottom: {
        marginBottom: 10,
    },
    goldLocationBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    zeptoSuggestionCardDisabled: {
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
        opacity: 0.6,
    },
    greenLocationBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    redLocationBadge: {
        backgroundColor: '#FEE2E2',
    },
    zeptoSuggestionTextGroup: {
        flex: 1,
        marginRight: 8,
    },
    zeptoSuggestionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        lineHeight: 20,
    },
    zeptoSuggestionAddress: {
        fontSize: 12.5,
        fontWeight: '400',
        color: '#4B5563',
        lineHeight: 18,
        marginTop: 3,
    },
    disabledText: {
        color: '#6B7280',
    },
    disabledTextSecondary: {
        color: '#9CA3AF',
    },
    distanceBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    zeptoDistanceTag: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#059669',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        overflow: 'hidden',
    },
    zeptoDistanceTagRed: {
        color: '#DC2626',
        backgroundColor: '#FEF2F2',
    },
    zeptoNotDeliverablePill: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    zeptoNotDeliverableText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#991B1B',
    },
    mapContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    selectedAddressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    purpleLocationBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    addressTextWrapper: {
        flex: 1,
    },
    addressTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    addressFullText: {
        fontSize: 13,
        color: '#4B5563',
        marginTop: 2,
        lineHeight: 18,
    },
    cityPincodeRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    cityText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    pincodeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    serviceableBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        gap: 8,
    },
    serviceableText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#047857',
        flex: 1,
    },
    notServiceableBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        gap: 8,
    },
    bannerTextGroup: {
        flex: 1,
    },
    notServiceableText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#991B1B',
        lineHeight: 17,
    },
    distanceSubtext: {
        fontSize: 11.5,
        fontWeight: '500',
        color: '#B91C1C',
        marginTop: 2,
    },
    tagSection: {
        marginBottom: 16,
    },
    tagSectionTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#111827',
    },
    tagSectionAddress: {
        fontSize: 12.5,
        color: '#6B7280',
        marginTop: 1,
        marginBottom: 12,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    typeButtonActiveHome: {
        backgroundColor: '#7C3AED',
    },
    typeButtonActiveOffice: {
        backgroundColor: '#6D28D9',
    },
    typeButtonActiveOther: {
        backgroundColor: '#9333EA',
    },
    typeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    typeTextActive: {
        color: '#FFFFFF',
    },
    confirmTouchable: {
        marginTop: 12,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#6D28D9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    confirmGradientButton: {
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenConfirmGradient: {
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    confirmButtonTextDisabled: {
        color: '#9CA3AF',
    },
});
