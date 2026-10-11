import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, View, ScrollView, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import {
    AnimatedScreen,
    BottomSheet,
    Button,
    Card,
    ContentSwap,
    EmptyState,
    GlassSurface,
    GradientHeader,
    IconButton,
    KeyboardLift,
    Screen,
    SkeletonGroup,
    SkeletonListRow,
    Text,
    toast,
} from '../components/ui';
import { radii, space, type } from '../constants/theme';
import { layout, makeStyles, useTheme } from '../theme';
import { PlaceSuggestions } from './address/PlaceSuggestions';
import { SavedAddressCard } from './address/SavedAddressCard';
import { CurrentLocationRow } from './address/CurrentLocationRow';
import { useServiceArea } from './address/useServiceArea';
import { formatAddressLine } from './address/addressUtils';

// How long a swiped-away address can be restored before the delete reaches the server.
const UNDO_MS = 4000;
// Reanimated web scales a container whose size changes (text distorts): native-only there.
const sizeLayout = Platform.OS === 'web' ? undefined : layout.list;

const LocationScreen = ({ navigation }) => {
    const styles = useStyles();
    const { colors, headerThemes, isDark } = useTheme();
    const header = headerThemes.default;
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const serviceArea = useServiceArea();

    const { selectedAddress, savedAddresses, isLoading } = useSelector(
        (state) => state.location
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingLoading, setIsSearchingLoading] = useState(false);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [barHeight, setBarHeight] = useState(0);
    // Swipe-to-delete with undo: the address leaves the list at once, the server delete waits UNDO_MS.
    const pendingSwipe = useRef(null);

    // Live debounced search for address recommendations
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
        }, 500); // debounce to reduce API calls

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

                    if (!seen.has(key) && (addr._id || `saved-${index}`) !== pendingSwipe.current?.item.id) {
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
            if (__DEV__) console.log('Failed to fetch addresses:', error?.response?.status === 401 ? 'Unauthorized (User not logged in)' : error);
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
                toast.error(isHi ? 'अनुमति अस्वीकृत' : 'Location permission needed', {
                    description: isHi
                        ? 'स्थान सेवा का उपयोग करने के लिए स्थान अनुमति आवश्यक है।'
                        : 'Allow location access in settings to use your current location.',
                });
                return;
            }

            dispatch(setCurrentLocation(loc));
            dispatch(setSelectedAddress(loc));
            dispatch(setLocationEnabled(true));
        } catch (error) {
            toast.error(isHi ? 'स्थान नहीं मिला' : "Couldn't get your location", {
                description: isHi ? 'कृपया फिर से प्रयास करें।' : 'Please try again.',
            });
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

    const handleSelectAddress = useCallback((address) => {
        dispatch(setSelectedAddress(address));
    }, [dispatch]);

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
                    if (__DEV__) console.log('Failed to save confirmed location:', err);
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

    const handleEditAddress = useCallback((item, index) => {
        navigation.navigate('AddAddress', {
            editAddress: { ...item, listIndex: index },
            addressIndex: item.originalIndex ?? index,
        });
    }, [navigation]);

    const handleRequestDelete = useCallback((item, index) => {
        setPendingDelete({ ...item, listIndex: index });
    }, []);

    const handleDeleteAddress = async () => {
        const targetItem = pendingDelete;
        setPendingDelete(null);
        if (!targetItem) return;
        try {
            setIsFetchingAddresses(true);
            const targetIndex = targetItem.originalIndex ?? targetItem.listIndex;
            await UserService.removeAddress(targetIndex);

            dispatch(removeSavedAddress(targetItem.id));
            await fetchSavedAddresses();
            toast.success(isHi ? 'पता हटा दिया गया' : 'Address deleted');
        } catch (error) {
            console.error('Delete address failed:', error);
            toast.error(isHi ? 'पता हटाने में विफल' : "Couldn't delete the address");
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    // --- Swipe to delete (optimistic, with Undo) -------------------------------------------
    const latest = useRef({ savedAddresses, selectedAddress });
    latest.current = { savedAddresses, selectedAddress, isHi };

    const commitSwipeDelete = useCallback(async (entry) => {
        clearTimeout(entry.timer);
        if (pendingSwipe.current === entry) pendingSwipe.current = null;
        const { item } = entry;
        try {
            // Server indices shift as addresses change, so resolve this one by id right before deleting.
            let target = item.originalIndex ?? item.listIndex;
            if (!String(item.id).startsWith('saved-')) {
                const profile = await UserService.getProfile();
                const list = profile?.addresses || [];
                const at = list.findIndex((a) => a?._id === item.id);
                if (at < 0) return; // already gone
                target = at;
            }
            await UserService.removeAddress(target);
        } catch (error) {
            console.error('Delete address failed:', error);
            toast.error(latest.current.isHi ? 'पता हटाने में विफल' : "Couldn't delete the address");
        } finally {
            fetchSavedAddressesRef.current();
        }
    }, []);

    const handleSwipeDelete = useCallback((item, index) => {
        if (pendingSwipe.current) commitSwipeDelete(pendingSwipe.current);
        const { selectedAddress: prevSelected, savedAddresses: prevList } = latest.current;
        const wasSelected = prevSelected?.id === item.id;
        dispatch(removeSavedAddress(item.id));
        if (wasSelected) dispatch(setSelectedAddress(prevList.find((a) => a.id !== item.id) || null));

        const entry = { item: { ...item, listIndex: index } };
        entry.timer = setTimeout(() => commitSwipeDelete(entry), UNDO_MS);
        pendingSwipe.current = entry;

        toast.show({
            message: isHi ? 'पता हटा दिया गया' : 'Address deleted',
            duration: UNDO_MS,
            bottomOffset: Math.max(0, barHeight - insets.bottom) + space.sm,
            action: {
                label: isHi ? 'वापस लाएं' : 'Undo',
                onPress: () => {
                    if (pendingSwipe.current !== entry) return;
                    clearTimeout(entry.timer);
                    pendingSwipe.current = null;
                    const now = latest.current.savedAddresses.filter((a) => a.id !== item.id);
                    const restored = [...now.slice(0, index), item, ...now.slice(index)];
                    dispatch(setSavedAddresses(restored));
                    if (wasSelected) dispatch(setSelectedAddress(prevSelected));
                },
            },
        });
    }, [barHeight, commitSwipeDelete, dispatch, insets.bottom, isHi]);

    // Leaving the screen ends the undo window: send the pending delete now.
    useEffect(() => () => {
        if (pendingSwipe.current) commitSwipeDelete(pendingSwipe.current);
    }, [commitSwipeDelete]);

    const handleSetDefaultAddress = useCallback(async (item, index) => {
        try {
            setIsFetchingAddresses(true);
            const targetIndex = item.originalIndex ?? index;
            await UserService.updateAddress(targetIndex, {
                ...item,
                isDefault: true,
            });
            await fetchSavedAddressesRef.current();
        } catch (error) {
            console.error('Set default address failed:', error);
        } finally {
            setIsFetchingAddresses(false);
        }
    }, []);

    // Address list to display (no hardcoded fallbacks — show empty state instead)
    const displayAddresses = savedAddresses || [];

    const currentDisplayAddr = selectedAddress || displayAddresses[0] || null;
    const deliverable = serviceArea.isServiceable(currentDisplayAddr);
    const currentDistance = serviceArea.distanceKm(currentDisplayAddr);

    const addrState = isFetchingAddresses && displayAddresses.length === 0
        ? 'loading'
        : displayAddresses.length === 0 ? 'empty' : 'data';

    return (
        <Screen edges={[]} statusBar={header.statusBar} topInsetColor={header.bg}>
            <AnimatedScreen>
                {/* Plain surface header with the search field */}
                <GradientHeader style={styles.header}>
                    <View style={styles.headerRow}>
                        <IconButton name="arrow-left" variant="ghost" accessibilityLabel={isHi ? 'वापस जाएं' : 'Go back'} onPress={handleBack} />
                        <Text variant="h3" accessibilityRole="header" style={styles.flex}>
                            {isHi ? 'कहाँ डिलीवर करें?' : 'Where should we deliver?'}
                        </Text>
                    </View>
                    <GlassSurface radius="input" bordered={false} style={styles.search}>
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.inkSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={isHi ? 'क्षेत्र, सड़क या लैंडमार्क खोजें' : 'Search area, street or landmark'}
                            placeholderTextColor={colors.inkMuted}
                            selectionColor={colors.brand}
                            keyboardAppearance={isDark ? 'dark' : 'light'}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                            accessibilityLabel={isHi ? 'स्थान खोजें' : 'Search for a location'}
                        />
                        {searchQuery.length > 0 ? (
                            <IconButton
                                name="close"
                                size="sm"
                                variant="ghost"
                                accessibilityLabel={isHi ? 'खोज साफ़ करें' : 'Clear search'}
                                onPress={handleClearSearch}
                            />
                        ) : null}
                    </GlassSurface>
                </GradientHeader>

                {/* Search results ⇄ map + saved addresses crossfade (no pop) */}
                <ContentSwap stateKey={isSearching ? 'search' : 'list'} style={styles.flex}>
                    {isSearching ? (
                        <View style={styles.resultsWrap}>
                            <PlaceSuggestions
                                loading={isSearchingLoading}
                                items={suggestions}
                                onSelect={handleSelectSuggestion}
                                distanceKm={serviceArea.distanceKm}
                                radiusKm={serviceArea.radiusKm}
                                isHi={isHi}
                                style={styles.results}
                            />
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.flex}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
                        >
                            <CurrentLocationRow
                                loading={isLoading}
                                onPress={handleEnableLocation}
                                etaMinutes={serviceArea.etaMinutes}
                                isHi={isHi}
                            />

                            {/* Map preview of the chosen spot */}
                            <Card padding={0} style={styles.mapCard}>
                                <View style={styles.map}>
                                    <MapViewContainer
                                        latitude={currentDisplayAddr?.latitude}
                                        longitude={currentDisplayAddr?.longitude}
                                        addressText={formatAddressLine(currentDisplayAddr, { pincode: false }) || null}
                                        onMapPress={handleMapPress}
                                        storeLocation={serviceArea.store}
                                    />
                                </View>
                            </Card>

                            {!deliverable ? (
                                <Animated.View entering={layout.enter} exiting={layout.exit}>
                                    <Card padding="md">
                                        <EmptyState
                                            compact
                                            mood="sad"
                                            title={isHi ? 'हम यहाँ अभी डिलीवर नहीं करते' : "We don't deliver here yet"}
                                            subtitle={isHi
                                                ? `यह स्थान स्टोर से ${currentDistance} किमी दूर है। ${serviceArea.radiusKm} किमी के भीतर कोई पता चुनें।`
                                                : `This spot is ${currentDistance} km from our store. Pick an address within ${serviceArea.radiusKm} km.`}
                                        />
                                    </Card>
                                </Animated.View>
                            ) : null}

                            {/* Saved addresses — slides as the warning above comes and goes */}
                            <Animated.View layout={sizeLayout} style={styles.section}>
                                <View style={styles.sectionHead}>
                                    <Text variant="h3" accessibilityRole="header">{isHi ? 'सहेजे गए पते' : 'Saved addresses'}</Text>
                                    <Button
                                        label={isHi ? 'नया जोड़ें' : 'Add new'}
                                        variant="ghost"
                                        size="sm"
                                        onPress={handleAddNewAddress}
                                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="plus" size={size} color={color} />}
                                    />
                                </View>

                                <ContentSwap stateKey={addrState}>
                                    {addrState === 'loading' ? (
                                        <SkeletonGroup style={styles.skeletons}>
                                            <SkeletonListRow />
                                            <SkeletonListRow />
                                        </SkeletonGroup>
                                    ) : addrState === 'empty' ? (
                                        <Card>
                                            <EmptyState
                                                compact
                                                title={isHi ? 'कोई सहेजा पता नहीं' : 'No saved addresses yet'}
                                                subtitle={isHi
                                                    ? 'नया पता जोड़ें या अपने वर्तमान स्थान का उपयोग करें।'
                                                    : 'Add a new address or use your current location.'}
                                                actionLabel={isHi ? 'पता जोड़ें' : 'Add address'}
                                                onAction={handleAddNewAddress}
                                            />
                                        </Card>
                                    ) : (
                                        <View style={styles.list}>
                                            {displayAddresses.map((item, index) => (
                                                <Animated.View
                                                    key={item.id || index}
                                                    entering={layout.enterAt(index)}
                                                    exiting={layout.exit}
                                                    layout={layout.list}
                                                >
                                                    <SavedAddressCard
                                                        item={item}
                                                        index={index}
                                                        selected={selectedAddress ? selectedAddress.id === item.id : index === 0}
                                                        distanceKm={serviceArea.distanceKm(item)}
                                                        deliverable={serviceArea.isServiceable(item)}
                                                        onSelect={handleSelectAddress}
                                                        onEdit={handleEditAddress}
                                                        onDelete={handleRequestDelete}
                                                        onSwipeDelete={handleSwipeDelete}
                                                        onMakeDefault={handleSetDefaultAddress}
                                                        isHi={isHi}
                                                    />
                                                </Animated.View>
                                            ))}
                                        </View>
                                    )}
                                </ContentSwap>
                            </Animated.View>
                        </ScrollView>
                    )}
                </ContentSwap>

                {/* Deliver here bar — rides the keyboard while the search field is focused */}
                <KeyboardLift offset={insets.bottom} style={[styles.barDock, { pointerEvents: 'box-none' }]}>
                    {!isSearching ? (
                        <Animated.View
                            entering={layout.enter}
                            exiting={layout.exit}
                            onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
                            style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}
                        >
                            <View style={styles.barRow}>
                                <View style={[styles.barIcon, !deliverable && styles.barIconOff]}>
                                    <MaterialCommunityIcons
                                        name={deliverable ? 'map-marker-check-outline' : 'map-marker-off-outline'}
                                        size={20}
                                        color={deliverable ? colors.inkSecondary : colors.errorInk}
                                    />
                                </View>
                                <View style={styles.barTexts}>
                                    <Text variant="caption" color="muted">{isHi ? 'यहाँ डिलीवरी करें' : 'Deliver to'}</Text>
                                    <Text variant="bodyStrong" numberOfLines={1}>
                                        {formatAddressLine(currentDisplayAddr, { pincode: false }) || (isHi ? 'कोई स्थान नहीं चुना गया' : 'No location selected')}
                                    </Text>
                                </View>
                            </View>
                            <Button
                                label={deliverable ? (isHi ? 'स्थान की पुष्टि करें' : 'Confirm location') : (isHi ? 'डिलीवरी उपलब्ध नहीं' : 'Not deliverable')}
                                size="lg"
                                fullWidth
                                disabled={!deliverable}
                                onPress={handleConfirmLocation}
                            />
                        </Animated.View>
                    ) : null}
                </KeyboardLift>
            </AnimatedScreen>

            <BottomSheet
                visible={!!pendingDelete}
                onClose={() => setPendingDelete(null)}
                title={isHi ? 'यह पता हटाएं?' : 'Delete this address?'}
                subtitle={pendingDelete ? formatAddressLine(pendingDelete) : undefined}
                floating
                footer={(
                    <View style={styles.sheetActions}>
                        <Button label={isHi ? 'रद्द करें' : 'Cancel'} variant="outline" style={styles.flex} onPress={() => setPendingDelete(null)} />
                        <Button label={isHi ? 'हटाएं' : 'Delete'} variant="danger" style={styles.flex} onPress={handleDeleteAddress} />
                    </View>
                )}
            />
        </Screen>
    );
};

export default LocationScreen;

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    header: { gap: space.md, paddingBottom: space.lg, marginBottom: space.md },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: -space.xs },
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 48,
        paddingLeft: space.lg,
        paddingRight: space.xs,
        backgroundColor: t.colors.surfaceSunken,
    },
    searchInput: { flex: 1, ...type.body, color: t.colors.ink, paddingVertical: space.sm, outlineStyle: 'none' },
    resultsWrap: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg },
    results: { flexShrink: 1 },
    content: { paddingHorizontal: space.lg, gap: space.lg },
    mapCard: { overflow: 'hidden' },
    map: { height: 200 },
    section: { gap: space.lg },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
    skeletons: { gap: space.md },
    list: { gap: space.md },
    barDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    bar: {
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingTop: space.lg,
        backgroundColor: t.colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        ...t.shadows.floating,
    },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    barIcon: {
        width: 40,
        height: 40,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    barIconOff: { backgroundColor: t.colors.errorTint },
    barTexts: { flex: 1, gap: space.xxs },
    sheetActions: { flexDirection: 'row', gap: space.md },
}));
