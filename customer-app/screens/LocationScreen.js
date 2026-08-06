import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Modal,
    Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Location01Icon,
    Target01Icon,
    Home01Icon,
    Briefcase01Icon,
    ShoppingBag01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    FlashIcon,
    MoreVerticalIcon,
    Navigation01Icon,
    PencilEdit01Icon,
    Delete02Icon,
    CheckmarkCircle01Icon,
    Cancel01Icon,
} from 'hugeicons-react-native';
import {
    setCurrentLocation,
    setSelectedAddress,
    setLocationEnabled,
    setLoading,
    setSavedAddresses,
    removeSavedAddress,
} from '../store/slices/locationSlice';
import { UserService, searchPlaces } from '../services';
import { useTranslation } from '../hooks/useTranslation';

import MapViewContainer from '../components/MapViewContainer';

// Store Center Location for distance calculation
const STORE_LOCATION = {
    latitude: 26.7588,
    longitude: 83.3700,
    maxRadiusKm: 15.0,
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
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

const LocationScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();

    const { selectedAddress, savedAddresses, isLoading } = useSelector(
        (state) => state.location
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingLoading, setIsSearchingLoading] = useState(false);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const [selectedAddressForAction, setSelectedAddressForAction] = useState(null);
    const [actionModalVisible, setActionModalVisible] = useState(false);

    // Live debounced search effect for Zepto-style address recommendations
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSuggestions([]);
            setIsSearching(false);
            setIsSearchingLoading(false);
            return;
        }

        setIsSearching(true);
        setIsSearchingLoading(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchPlaces(searchQuery.trim(), selectedAddress?.coords || null);
                setSuggestions(results || []);
            } catch (err) {
                console.log('Search places error in LocationScreen:', err);
                setSuggestions([]);
            } finally {
                setIsSearchingLoading(false);
            }
        }, 500); // Increased debounce time to reduce API calls

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectSuggestion = (item) => {
        const fullAddrStr = item.name && !item.formattedAddress?.includes(item.name)
            ? `${item.name}, ${item.formattedAddress}`
            : item.formattedAddress || item.name;

        const formattedAddress = {
            id: item.placeId || `search-${Date.now()}`,
            type: 'Searched Location',
            address: fullAddrStr,
            city: item.city || 'Gorakhpur',
            pincode: item.pincode || '',
            isDefault: false,
            latitude: item.latitude,
            longitude: item.longitude,
            coords: item.latitude && item.longitude ? { latitude: item.latitude, longitude: item.longitude } : null,
        };

        dispatch(setSelectedAddress(formattedAddress));
        setIsSearching(false);
        setSuggestions([]);
        setSearchQuery('');
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSuggestions([]);
        setIsSearching(false);
    };

    const fetchSavedAddresses = async () => {
        setIsFetchingAddresses(true);
        try {
            const profile = await UserService.getProfile();
            if (profile?.addresses && profile.addresses.length > 0) {
                const seen = new Set();
                const uniqueAddresses = [];

                profile.addresses.forEach((addr, index) => {
                    const normAddress = (addr.address || '').toLowerCase().trim();
                    const normCity = (addr.city || '').toLowerCase().trim();
                    const key = `${normAddress}_${normCity}_${addr.type}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueAddresses.push({
                            id: addr._id || `saved-${index}`,
                            originalIndex: index,
                            type: addr.type,
                            address: addr.address,
                            city: addr.city,
                            pincode: addr.pincode,
                            isDefault: addr.isDefault,
                            latitude: addr.latitude,
                            longitude: addr.longitude,
                        });
                    }
                });

                // If there's exactly 1 address, force it to be default visually on frontend
                if (uniqueAddresses.length === 1) {
                    uniqueAddresses[0].isDefault = true;
                }

                dispatch(setSavedAddresses(uniqueAddresses));

                // Select default address if none selected or if previously selected address no longer exists
                const defaultAddr = uniqueAddresses.find((a) => a.isDefault);
                const selectedStillExists = selectedAddress && uniqueAddresses.some(a => a.id === selectedAddress.id);

                if (defaultAddr && (!selectedAddress || !selectedStillExists)) {
                    dispatch(setSelectedAddress(defaultAddr));
                } else if (!selectedStillExists && uniqueAddresses.length > 0) {
                    dispatch(setSelectedAddress(uniqueAddresses[0]));
                } else if (uniqueAddresses.length === 0) {
                    dispatch(setSelectedAddress(null));
                }
            } else {
                dispatch(setSavedAddresses([]));
                dispatch(setSelectedAddress(null));
            }
        } catch (error) {
            console.log('Failed to fetch addresses:', error?.response?.status === 401 ? 'Unauthorized (User not logged in)' : error);
            dispatch(setSavedAddresses([]));
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Main');
        }
    };

    // Detect the user's current (GPS) location. Returns the formatted address
    // object, or null if permission was denied / location unavailable.
    const detectCurrentLocation = useCallback(async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return null;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        let addressText = 'Medical Road, Gorakhpur';
        let city = 'Gorakhpur';
        let pincode = '273001';
        try {
            const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (address) {
                addressText = `${address.name || ''} ${address.street || ''}`.trim() || addressText;
                city = address.city || address.subregion || city;
                pincode = address.postalCode || pincode;
            }
        } catch (err) {
            console.log('Reverse geocode error during location detect:', err);
        }

        return {
            id: `current-${Date.now()}`,
            type: isHi ? 'वर्तमान स्थान' : 'Current Location',
            address: addressText,
            city,
            pincode,
            isDefault: false,
            latitude,
            longitude,
            coords: { latitude, longitude },
        };
    }, [isHi]);

    const handleEnableLocation = async () => {
        dispatch(setLoading(true));
        try {
            const loc = await detectCurrentLocation();
            if (!loc) {
                dispatch(setLoading(false));
                Alert.alert(
                    isHi ? 'अनुमति अस्वीकृत' : 'Permission Denied',
                    isHi
                        ? 'स्थान सेवा का उपयोग करने के लिए स्थान अनुमति आवश्यक है।'
                        : 'Location permission is required to use this feature. Please enable it in settings.'
                );
                return;
            }

            dispatch(setCurrentLocation(loc));
            dispatch(setSelectedAddress(loc));
            dispatch(setLocationEnabled(true));
        } catch (error) {
            Alert.alert(
                isHi ? 'त्रुटि' : 'Error',
                isHi ? 'आपका स्थान प्राप्त करने में विफल रहा।' : 'Failed to get your location. Please try again.'
            );
            console.error('Location error:', error);
        } finally {
            dispatch(setLoading(false));
        }
    };

    // Auto-detect the current location when the map opens with nothing selected,
    // so the map centres on the user instead of a hardcoded fallback.
    const autoLocatedRef = useRef(false);
    const autoDetectCurrentLocation = useCallback(async () => {
        if (autoLocatedRef.current) return;
        if (selectedAddress) return;

        try {
            const loc = await detectCurrentLocation();
            if (loc) {
                dispatch(setCurrentLocation(loc));
                dispatch(setSelectedAddress(loc));
                dispatch(setLocationEnabled(true));
                autoLocatedRef.current = true;
            }
        } catch (err) {
            console.log('Auto location detect failed:', err);
        }
    }, [detectCurrentLocation, selectedAddress, dispatch]);

    // Fetch saved addresses + auto-detect current location on every focus.
    // Refs keep the effect callback stable so it doesn't re-run in a loop.
    const fetchSavedAddressesRef = useRef(fetchSavedAddresses);
    fetchSavedAddressesRef.current = fetchSavedAddresses;
    const autoDetectRef = useRef(autoDetectCurrentLocation);
    autoDetectRef.current = autoDetectCurrentLocation;

    useFocusEffect(
        useCallback(() => {
            fetchSavedAddressesRef.current();
            autoDetectRef.current();
        }, [])
    );

    const handleSelectAddress = (address) => {
        dispatch(setSelectedAddress(address));
    };

    const handleMapPress = async (coords) => {
        if (!coords) return;
        const { latitude, longitude } = coords;
        try {
            const [res] = await Location.reverseGeocodeAsync({ latitude, longitude });
            const addressText = res
                ? [res.name, res.street, res.district].filter(Boolean).join(', ')
                : 'Medical Road, Gorakhpur';
            const city = res?.city || res?.subregion || 'Gorakhpur';
            const pincode = res?.postalCode || '273001';

            const formattedAddress = {
                id: `map-${Date.now()}`,
                type: 'Selected Location',
                address: addressText,
                city,
                pincode,
                isDefault: false,
                latitude,
                longitude,
                coords: { latitude, longitude },
            };

            dispatch(setSelectedAddress(formattedAddress));
        } catch (err) {
            console.log('Map press reverse geocode error:', err);
        }
    };

    const handleConfirmLocation = async () => {
        // Ensure there is a selected address (auto-detect current location if needed)
        if (!selectedAddress) {
            try {
                const loc = await detectCurrentLocation();
                if (loc) {
                    dispatch(setCurrentLocation(loc));
                    dispatch(setSelectedAddress(loc));
                }
            } catch (err) {
                console.log('Confirm location detect failed:', err);
            }
        }

        const current = selectedAddress;
        if (current && current.latitude && current.longitude) {
            const alreadySaved = savedAddresses.some(
                (a) =>
                    (a.address || '').toLowerCase() === (current.address || '').toLowerCase() &&
                    (a.city || '').toLowerCase() === (current.city || '').toLowerCase()
            );

            if (!alreadySaved) {
                try {
                    const type =
                        current.type === 'Current Location' || current.type === 'Selected Location'
                            ? 'Home'
                            : current.type;
                    await UserService.addAddress({
                        type,
                        address: current.address,
                        city: current.city || 'Gorakhpur',
                        pincode: current.pincode || '273001',
                        isDefault: savedAddresses.length === 0,
                        latitude: current.latitude,
                        longitude: current.longitude,
                    });
                } catch (err) {
                    console.log('Failed to save confirmed location:', err);
                }
            }
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Main');
        }
    };

    const handleSearchSubmit = async () => {
        if (!searchQuery.trim()) return;

        dispatch(setLoading(true));
        try {
            const results = await Location.geocodeAsync(searchQuery.trim());
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];

                const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
                const addressText = address
                    ? [address.name, address.street, address.district].filter(Boolean).join(', ')
                    : searchQuery.trim();
                const city = address?.city || address?.subregion || 'Gorakhpur';
                const pincode = address?.postalCode || '273001';

                const formattedAddress = {
                    id: `search-${Date.now()}`,
                    type: 'Other',
                    address: addressText,
                    city,
                    pincode,
                    isDefault: false,
                    latitude,
                    longitude,
                    coords: { latitude, longitude },
                };

                dispatch(setSelectedAddress(formattedAddress));
                setSearchQuery('');
            } else {
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

    const handleOpenActionMenu = (item, index) => {
        setSelectedAddressForAction({ ...item, listIndex: index });
        setActionModalVisible(true);
    };

    const handleEditAddress = () => {
        setActionModalVisible(false);
        if (!selectedAddressForAction) return;
        navigation.navigate('AddAddress', {
            editAddress: selectedAddressForAction,
            addressIndex: selectedAddressForAction.originalIndex ?? selectedAddressForAction.listIndex,
        });
    };

    const handleDeleteAddress = () => {
        setActionModalVisible(false);
        if (!selectedAddressForAction) return;
        const targetItem = selectedAddressForAction;

        Alert.alert(
            isHi ? 'पता हटाएं' : 'Delete Address',
            isHi ? 'क्या आप निश्चित रूप से इस पते को हटाना चाहते हैं?' : 'Are you sure you want to delete this address?',
            [
                { text: isHi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                {
                    text: isHi ? 'हटाएं' : 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsFetchingAddresses(true);
                            const targetIndex = targetItem.originalIndex ?? targetItem.listIndex;
                            await UserService.removeAddress(targetIndex);

                            dispatch(removeSavedAddress(targetItem.id));
                            await fetchSavedAddresses();
                            Alert.alert(
                                isHi ? 'सफलता' : 'Success',
                                isHi ? 'पता सफलतापूर्वक हटा दिया गया।' : 'Address deleted successfully.'
                            );
                        } catch (error) {
                            console.error('Delete address failed:', error);
                            Alert.alert(
                                isHi ? 'त्रुटि' : 'Error',
                                isHi ? 'पता हटाने में विफल।' : 'Failed to delete address.'
                            );
                        } finally {
                            setIsFetchingAddresses(false);
                        }
                    },
                },
            ]
        );
    };

    const handleSetDefaultAddress = async () => {
        setActionModalVisible(false);
        if (!selectedAddressForAction) return;

        try {
            setIsFetchingAddresses(true);
            const targetIndex = selectedAddressForAction.originalIndex ?? selectedAddressForAction.listIndex;
            await UserService.updateAddress(targetIndex, {
                ...selectedAddressForAction,
                isDefault: true,
            });
            await fetchSavedAddresses();
        } catch (error) {
            console.error('Set default address failed:', error);
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    // Address list to display (no hardcoded fallbacks — show empty state instead)
    const displayAddresses = savedAddresses || [];

    const currentDisplayAddr = selectedAddress || displayAddresses[0] || null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAF8FF" />

            {/* 1. HEADER */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={handleBack}
                    activeOpacity={0.8}
                >
                    <ArrowLeft01Icon size={20} color="#1E1B4B" strokeWidth={2.2} />
                </TouchableOpacity>
                <View style={styles.headerTitleGroup}>
                    <Text style={styles.headerTitle}>
                        {isHi ? 'स्थान चुनें' : 'Select Location'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {isHi ? 'अपना डिलीवरी स्थान चुनें' : 'Select your delivery location'}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* 2. SEARCH BAR */}
                <View style={styles.searchCard}>
                    <Location01Icon size={20} color="#7C3AED" strokeWidth={2} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={
                            isHi ? 'क्षेत्र, सड़क या लैंडमार्क खोजें' : 'Search area, street or landmark'
                        }
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
                            <Cancel01Icon size={18} color="#6B7280" strokeWidth={2} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleEnableLocation} activeOpacity={0.7}>
                            <Target01Icon size={20} color="#7C3AED" strokeWidth={2} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* 3. DYNAMIC EXPANDED SEARCH SUGGESTIONS OVERLAY */}
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
                            <View style={styles.suggestionsListGroup}>
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
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        {/* 4. USE MY CURRENT LOCATION BANNER */}
                        <TouchableOpacity
                            style={styles.currentLocationCard}
                            activeOpacity={0.9}
                            onPress={handleEnableLocation}
                            disabled={isLoading}
                        >
                            <View style={styles.currentLocationLeft}>
                                <View style={styles.navIconBadge}>
                                    <Navigation01Icon size={20} color="#7C3AED" strokeWidth={2.2} />
                                </View>
                                <View style={styles.currentLocationTextGroup}>
                                    <Text style={styles.currentLocationTitle}>
                                        {isHi ? 'वर्तमान स्थान का उपयोग करें' : 'Use my current location'}
                                    </Text>
                                    <Text style={styles.currentLocationSubtitle}>
                                        {isHi
                                            ? 'हम आपके वर्तमान स्थान पर डिलीवरी करेंगे'
                                            : "We'll deliver to your current location"}
                                    </Text>
                                    <View style={styles.expressTagRow}>
                                        <FlashIcon size={13} color="#7C3AED" strokeWidth={2.5} />
                                        <Text style={styles.expressTagText}>
                                            {isHi ? '10 मिनट में डिलीवरी' : 'Delivering in 10 minutes'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.useLocationBtn}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.useLocationBtnText}>
                                        {isHi ? 'उपयोग करें' : 'Use Location'}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* 5. SAVED ADDRESSES SECTION */}
                        <View style={styles.savedSectionHeader}>
                            <Text style={styles.savedSectionTitle}>
                                {isHi ? 'सहेजे गए पते' : 'Saved Addresses'}
                            </Text>
                            <TouchableOpacity onPress={handleAddNewAddress} activeOpacity={0.7}>
                                <Text style={styles.addNewLinkText}>
                                    {isHi ? '+ नया जोड़ें' : '+ Add New'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Grouped Addresses Card */}
                        <View style={styles.addressCardGroup}>
                            {isFetchingAddresses ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="small" color="#7C3AED" />
                                </View>
                            ) : displayAddresses.length === 0 ? (
                                <View style={styles.emptyAddressBox}>
                                    <Home01Icon size={28} color="#C4B5FD" />
                                    <Text style={styles.emptyAddressText}>
                                        {isHi
                                            ? 'कोई सहेजा गया पता नहीं। नया पता जोड़ें या अपने वर्तमान स्थान का उपयोग करें।'
                                            : 'No saved addresses. Add a new address or use your current location.'}
                                    </Text>
                                </View>
                            ) : (
                                displayAddresses.map((item, index) => {
                                    const isSelected =
                                        selectedAddress?.id === item.id ||
                                        (!selectedAddress && index === 0);
                                    const isHome = item.type?.toLowerCase() === 'home';

                                    return (
                                        <View key={item.id || index}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.addressRowItem,
                                                    isSelected && styles.addressRowItemSelected,
                                                ]}
                                                activeOpacity={0.8}
                                                onPress={() => dispatch(setSelectedAddress(item))}
                                            >
                                                {/* Icon Badge */}
                                                <View
                                                    style={[
                                                        styles.addressIconBg,
                                                        {
                                                            backgroundColor: isHome
                                                                ? '#F3E8FF'
                                                                : '#FCE7F3',
                                                        },
                                                    ]}
                                                >
                                                    {isHome ? (
                                                        <Home01Icon size={18} color="#7C3AED" strokeWidth={2.2} />
                                                    ) : (
                                                        <Briefcase01Icon size={18} color="#EC4899" strokeWidth={2.2} />
                                                    )}
                                                </View>

                                                {/* Content */}
                                                <View style={styles.addressTextContent}>
                                                    <View style={styles.addressTitleRow}>
                                                        <Text style={styles.addressTypeTitle}>
                                                            {item.type || (isHome ? 'Home' : 'Office')}
                                                        </Text>
                                                        {item.isDefault && (
                                                            <View style={styles.defaultPill}>
                                                                <Text style={styles.defaultPillText}>
                                                                    {isHi ? 'डिफ़ॉल्ट' : 'Default'}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text
                                                        style={styles.addressFullText}
                                                        numberOfLines={1}
                                                    >
                                                        {item.address}
                                                        {item.city ? `, ${item.city}` : ''}
                                                        {item.pincode ? ` - ${item.pincode}` : ''}
                                                    </Text>
                                                </View>

                                                {/* More Options */}
                                                <TouchableOpacity
                                                    style={styles.moreIconBtn}
                                                    activeOpacity={0.6}
                                                    onPress={() => handleOpenActionMenu(item, index)}
                                                >
                                                    <MoreVerticalIcon size={18} color="#9CA3AF" strokeWidth={2} />
                                                </TouchableOpacity>
                                            </TouchableOpacity>

                                            {index < displayAddresses.length - 1 && (
                                                <View style={styles.addressRowDivider} />
                                            )}
                                        </View>
                                    );
                                })
                            )}

                            {/* Full Width "+ Add New Address" button inside Group */}
                            <TouchableOpacity
                                style={styles.innerAddAddressBtn}
                                activeOpacity={0.8}
                                onPress={handleAddNewAddress}
                            >
                                <Location01Icon size={18} color="#7C3AED" strokeWidth={2.2} />
                                <Text style={styles.innerAddAddressText}>
                                    {isHi ? 'नया पता जोड़ें' : 'Add New Address'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 6. REAL MAP PREVIEW CARD WITH 3D LOCATOR & FULL ADDRESS TOOLTIP */}
                        <View style={styles.mapCardContainer}>
                            <View style={styles.mapCanvas}>
                                <MapViewContainer
                                    latitude={currentDisplayAddr?.latitude}
                                    longitude={currentDisplayAddr?.longitude}
                                    addressText={[
                                        currentDisplayAddr?.address,
                                        currentDisplayAddr?.city,
                                        currentDisplayAddr?.pincode ? `- ${currentDisplayAddr.pincode}` : ''
                                    ].filter(Boolean).join(', ') || 'Medical Road, Gorakhpur - 273001'}
                                    onMapPress={handleMapPress}
                                />

                                <TouchableOpacity
                                    style={styles.locateMeBtn}
                                    activeOpacity={0.85}
                                    onPress={handleEnableLocation}
                                >
                                    <Target01Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}

                <View style={{ height: 110 }} />
            </ScrollView>

            {/* 6. BOTTOM FLOATING "DELIVER HERE?" BAR */}
            <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <TouchableOpacity
                    style={styles.deliverHereBanner}
                    activeOpacity={0.9}
                    onPress={handleConfirmLocation}
                >
                    <View style={styles.deliverLeftContent}>
                        <View style={styles.bagIconBox}>
                            <ShoppingBag01Icon size={22} color="#FFFFFF" strokeWidth={2.2} />
                        </View>
                        <View style={styles.deliverTextGroup}>
                            <Text style={styles.deliverTitle}>
                                {isHi ? 'यहाँ डिलीवरी करें?' : 'Deliver here?'}
                            </Text>
                            <Text style={styles.deliverSubtitle} numberOfLines={1}>
                                {currentDisplayAddr?.address || 'Medical Road, Gorakhpur'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.confirmBtnPill}>
                        <Text style={styles.confirmBtnText}>
                            {isHi ? 'स्थान की पुष्टि करें' : 'Confirm Location'}
                        </Text>
                        <ArrowRight01Icon size={16} color="#7C3AED" strokeWidth={2.5} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* 7. 3-DOTS ACTION SHEET MODAL (EDIT / DELETE) */}
            <Modal
                visible={actionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setActionModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setActionModalVisible(false)}
                >
                    <View style={styles.actionSheetCard}>
                        <View style={styles.actionSheetHeader}>
                            <Text style={styles.actionSheetTitle}>
                                {selectedAddressForAction?.type || 'Address'} {isHi ? 'विकल्प' : 'Options'}
                            </Text>
                            <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                                {selectedAddressForAction?.address}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.actionItemRow}
                            onPress={handleEditAddress}
                            activeOpacity={0.7}
                        >
                            <PencilEdit01Icon size={20} color="#7C3AED" strokeWidth={2} />
                            <Text style={styles.actionItemText}>
                                {isHi ? 'पता अपडेट / संपादित करें' : 'Edit / Update Address'}
                            </Text>
                        </TouchableOpacity>

                        {!selectedAddressForAction?.isDefault && (
                            <TouchableOpacity
                                style={styles.actionItemRow}
                                onPress={handleSetDefaultAddress}
                                activeOpacity={0.7}
                            >
                                <CheckmarkCircle01Icon size={20} color="#059669" strokeWidth={2} />
                                <Text style={styles.actionItemText}>
                                    {isHi ? 'डिफ़ॉल्ट के रूप में सेट करें' : 'Set as Default Address'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.actionItemRow, styles.actionItemRowDelete]}
                            onPress={handleDeleteAddress}
                            activeOpacity={0.7}
                        >
                            <Delete02Icon size={20} color="#EF4444" strokeWidth={2} />
                            <Text style={[styles.actionItemText, styles.actionItemTextDelete]}>
                                {isHi ? 'पता हटाएं' : 'Delete Address'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCancelBtn}
                            onPress={() => setActionModalVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actionCancelText}>
                                {isHi ? 'रद्द करें' : 'Cancel'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

export default LocationScreen;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
    },
    actionSheetCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 34,
    },
    actionSheetHeader: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3E8FF',
        paddingBottom: 12,
        marginBottom: 8,
    },
    actionSheetTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    actionSheetSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    actionItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 12,
        marginVertical: 2,
    },
    actionItemRowDelete: {
        backgroundColor: '#FEF2F2',
        marginTop: 6,
    },
    actionItemText: {
        fontSize: 14.5,
        fontWeight: '700',
        color: '#1F2937',
    },
    actionItemTextDelete: {
        color: '#DC2626',
    },
    actionCancelBtn: {
        marginTop: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
    },
    actionCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4B5563',
    },
    container: {
        flex: 1,
        backgroundColor: '#FAF8FF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        backgroundColor: '#FAF8FF',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    headerTitleGroup: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.4,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 4,
    },

    /* SEARCH BAR */
    searchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 14,
        height: 50,
        borderWidth: 1,
        borderColor: '#F3E8FF',
        marginBottom: 16,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginLeft: 10,
        marginRight: 8,
    },
    clearSearchBtn: {
        padding: 4,
    },

    /* DYNAMIC SEARCH SUGGESTIONS OVERLAY */
    suggestionsContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E9D5FF',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    suggestionsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    suggestionsSectionHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: '#7C3AED',
        letterSpacing: 0.8,
    },
    emptySuggestionsBox: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptySuggestionsText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    suggestionsListGroup: {
        gap: 10,
    },
    zeptoSuggestionCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F3E8FF',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
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

    /* USE CURRENT LOCATION BANNER */
    currentLocationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F0FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 22,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    currentLocationLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        marginRight: 10,
    },
    navIconBadge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    currentLocationTextGroup: {
        marginLeft: 12,
        flex: 1,
    },
    currentLocationTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.2,
    },
    currentLocationSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 2,
    },
    expressTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    expressTagText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#7C3AED',
    },
    useLocationBtn: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    useLocationBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },

    /* SAVED ADDRESSES SECTION */
    savedSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    savedSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.3,
    },
    addNewLinkText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#7C3AED',
    },
    addressCardGroup: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F3E8FF',
        padding: 6,
        marginBottom: 22,

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    loadingBox: {
        padding: 24,
        alignItems: 'center',
    },
    emptyAddressBox: {
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    emptyAddressText: {
        fontSize: 13,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 19,
    },
    addressRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
    },
    addressRowItemSelected: {
        backgroundColor: '#FAF5FF',
    },
    addressIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressTextContent: {
        flex: 1,
        marginLeft: 12,
        marginRight: 6,
    },
    addressTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addressTypeTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    defaultPill: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    defaultPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7C3AED',
    },
    addressFullText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 3,
    },
    moreIconBtn: {
        padding: 6,
    },
    addressRowDivider: {
        height: 1,
        backgroundColor: '#F3E8FF',
        marginHorizontal: 12,
    },
    innerAddAddressBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F5F0FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
        borderRadius: 14,
        paddingVertical: 12,
        marginTop: 6,
    },
    innerAddAddressText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#7C3AED',
    },

    /* MAP CARD & 3D LOCATOR WITH ADDRESS TOOLTIP */
    mapCardContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#E9D5FF',
        backgroundColor: '#F5F0FF',
        height: 280,
        marginBottom: 20,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 4,
    },
    mapCanvas: {
        flex: 1,
        backgroundColor: '#EAE5F5',
        position: 'relative',
    },
    mapOverlayVignette: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(124, 58, 237, 0.03)',
    },
    nativeMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 260,
        padding: 4,
    },
    centerLocatorWrapper: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    /* FLOATING CLEAN ADDRESS (NO HEAVY CONTAINER) */
    floatingAddressWrapper: {
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 12,
        maxWidth: '92%',
        zIndex: 10000,
        elevation: 10000,
    },
    addressTypeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#E9D5FF',
        marginBottom: 6,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    addressTypeHeaderText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#7C3AED',
        letterSpacing: -0.2,
    },
    floatingAddressText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        lineHeight: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#F3E8FF',
        overflow: 'hidden',

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    /* PURPLE PIN MARKER (MATCHING USER REFERENCE IMAGE) */
    simpleLocatorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginTop: 4,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        elevation: 10000,
    },
    purplePinBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: '#FFFFFF',

        shadowColor: '#5B21B6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },
    pinTipArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 7,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#7C3AED',
        marginTop: -1,
    },
    groundShadowDot: {
        width: 14,
        height: 4,
        borderRadius: 7,
        backgroundColor: 'rgba(91, 33, 182, 0.4)',
        marginTop: 2,
    },
    locateMeBtn: {
        position: 'absolute',
        bottom: 14,
        right: 14,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E11D48',

        shadowColor: '#E11D48',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },

    /* BOTTOM FLOATING BAR */
    bottomBarWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
    },
    deliverHereBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#7C3AED',
        borderRadius: 22,
        paddingVertical: 12,
        paddingHorizontal: 16,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
    },
    deliverLeftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    bagIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deliverTextGroup: {
        marginLeft: 10,
        flex: 1,
    },
    deliverTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    deliverSubtitle: {
        fontSize: 11.5,
        fontWeight: '500',
        color: '#E9D5FF',
        marginTop: 1,
    },
    confirmBtnPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
    },
    confirmBtnText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#7C3AED',
    },
});
