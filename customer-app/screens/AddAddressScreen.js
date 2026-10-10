import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    TextInput,
    Dimensions,
    ScrollView,
    Platform,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { setSelectedAddress } from '../store/slices/locationSlice';
import { UserService } from '../services';
import { geocodeAddress, reverseGeocode as mapplsReverseGeocode, searchPlaces } from '../services';
import MapComponent from '../components/MapComponent';
import { useTranslation } from '../hooks/useTranslation';
import {
    Button,
    Chip,
    ContentSwap,
    EmptyState,
    GlassSurface,
    IconButton,
    Screen,
    Text,
    toast,
    useKeyboardSpring,
    useScreenEnter,
} from '../components/ui';
import { radii, space, type, z } from '../constants/theme';
import { layout, makeStyles, useTheme } from '../theme';
import { SaveButton } from './address/SaveButton';
import { FloatingInput } from './address/FloatingInput';
import { PlaceSuggestions } from './address/PlaceSuggestions';
import { useServiceArea } from './address/useServiceArea';

const { width, height } = Dimensions.get('window');
const SAVED_BEAT = 480; // ms the green check shows before navigating back
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const ADDRESS_TYPES = [
    { id: 'Home', en: 'Home', hi: 'घर', icon: 'home-variant-outline' },
    { id: 'Work', en: 'Work', hi: 'काम', icon: 'briefcase-outline' },
    { id: 'Other', en: 'Other', hi: 'अन्य', icon: 'map-marker-outline' },
];

// Older saved addresses use "Office"; the chip for it is "Work".
const normaliseType = (t) => (t === 'Office' ? 'Work' : ADDRESS_TYPES.some((a) => a.id === t) ? t : t ? 'Other' : 'Home');

const AddAddressScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const mapRef = useRef(null);
    const searchQuery = route.params?.searchQuery || '';
    const editAddress = route.params?.editAddress || null;
    const addressIndex = route.params?.addressIndex ?? null;
    const { isHi } = useTranslation();
    const serviceArea = useServiceArea();

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
        address: editAddress?.address || '',
        city: editAddress?.city || 'Gorakhpur',
        pincode: editAddress?.pincode || '',
    });
    const [house, setHouse] = useState('');
    const [errors, setErrors] = useState({});
    const [searchText, setSearchText] = useState(searchQuery);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchingLoading, setIsSearchingLoading] = useState(false);
    const [isServiceable, setIsServiceable] = useState(true);
    const [distanceKm, setDistanceKm] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const leaveTimer = useRef(null);
    useEffect(() => () => clearTimeout(leaveTimer.current), []);

    // Form sheet arrives with the screen (map stays put); it rides the keyboard on the UI thread.
    const enter = useScreenEnter({ offsetY: 16 });
    const mapHeight = Math.round(height * 0.42);
    // The sheet may slide up over the map, but never past the floating search bar.
    const maxLift = Math.max(0, mapHeight - space['2xl'] - (insets.top + space.sm + 48 + space.md));
    const { height: kb } = useKeyboardSpring();
    const sheetLift = useAnimatedStyle(() => ({
        transform: [{ translateY: -Math.min(Math.max(0, kb.value - insets.bottom), maxLift) }],
    }));
    // Whatever the lift can't clear becomes scroll room, so the last field and Save stay reachable.
    const keyboardRoom = useAnimatedStyle(() => ({
        height: Math.max(0, kb.value - insets.bottom - maxLift),
    }));
    const [addressType, setAddressType] = useState(normaliseType(editAddress?.type || 'Home'));

    // Live search debouncing effect for address suggestions
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

    // Re-check once the real store location / radius arrive from settings.
    useEffect(() => {
        if (selectedLocation) checkServiceability(selectedLocation.latitude, selectedLocation.longitude);
    }, [serviceArea.radiusKm, serviceArea.store.latitude, serviceArea.store.longitude]);

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
        const dist = serviceArea.distanceKm({ latitude, longitude });
        setDistanceKm(dist);
        setIsServiceable(dist === null || dist <= serviceArea.radiusKm);
    };

    const moveTo = async (latitude, longitude) => {
        setSelectedLocation({ latitude, longitude });
        setErrors({});
        await reverseGeocode(latitude, longitude);
        await checkServiceability(latitude, longitude);
    };

    const handleMapPress = async (event) => {
        const { latitude, longitude } = event?.nativeEvent?.coordinate || {};
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        setRegion((r) => ({ ...r, latitude, longitude }));
        await moveTo(latitude, longitude);
    };

    // The pin sits in the centre of the map: dragging the map moves the pin.
    const handleRegionChangeComplete = (newRegion, details) => {
        setRegion(newRegion);
        if (details?.isGesture) moveTo(newRegion.latitude, newRegion.longitude);
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
            setErrors({});

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
                toast.error(isHi ? 'स्थान नहीं मिला' : 'Location not found', {
                    description: isHi ? 'कोई दूसरा क्षेत्र या लैंडमार्क खोजें।' : 'Try another area or landmark.',
                });
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

    const validate = () => {
        const next = {};
        if (!addressDetails.address?.trim()) {
            next.address = isHi ? 'क्षेत्र / सड़क दर्ज करें' : 'Enter the area or street';
        }
        if (!addressDetails.city?.trim()) {
            next.city = isHi ? 'शहर दर्ज करें' : 'Enter the city';
        }
        if (!/^\d{6}$/.test(String(addressDetails.pincode || '').trim())) {
            next.pincode = isHi ? '6 अंकों का पिनकोड दर्ज करें' : 'Enter a 6-digit pincode';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleConfirmLocation = async () => {
        if (!selectedLocation || !isServiceable) return;
        if (!validate()) return;

        const fullAddress = [house.trim(), addressDetails.address.trim()].filter(Boolean).join(', ');
        const city = addressDetails.city.trim();
        const pincode = String(addressDetails.pincode).trim();

        setIsSaving(true);
        try {
            const isEditing = addressIndex !== null && addressIndex !== undefined;

            if (isEditing) {
                await UserService.updateAddress(addressIndex, {
                    type: addressType,
                    address: fullAddress,
                    city,
                    pincode,
                    isDefault: editAddress?.isDefault ?? true,
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });
            } else {
                await UserService.addAddress({
                    type: addressType,
                    address: fullAddress,
                    city,
                    pincode,
                    isDefault: true,
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });
            }

            const formattedAddress = {
                id: editAddress?.id || `saved-${Date.now()}`,
                type: addressType,
                address: fullAddress,
                city,
                pincode,
                isDefault: editAddress?.isDefault ?? true,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                coords: selectedLocation,
            };

            dispatch(setSelectedAddress(formattedAddress));
            // Let the button land on its green check (loading → check), then leave; the toast
            // follows on the next screen instead of covering the button.
            setSaved(true);
            leaveTimer.current = setTimeout(() => {
                toast.success(isHi ? 'पता सहेजा गया' : 'Address saved');
                if (!navigation.isFocused()) return;
                if (navigation.canGoBack()) {
                    navigation.goBack();
                } else {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Main' }],
                    });
                }
            }, SAVED_BEAT);
        } catch (error) {
            if (__DEV__) console.error('Failed to save address:', error);
            const fallbackAddress = {
                id: `loc-${Date.now()}`,
                type: addressType,
                address: fullAddress,
                city: city || 'Gorakhpur',
                pincode: pincode || '273202',
                isDefault: true,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
            };
            dispatch(setSelectedAddress(fallbackAddress));
            toast.info(isHi ? 'पता इस ऑर्डर के लिए चुना गया' : 'Using this address for now', {
                description: isHi ? 'हम इसे आपके खाते में सहेज नहीं सके।' : "We couldn't save it to your account.",
            });
            navigation.goBack();
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        navigation.goBack();
    };

    const setField = (key) => (text) => {
        setAddressDetails((d) => ({ ...d, [key]: key === 'pincode' ? text.replace(/[^0-9]/g, '') : text }));
        if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };


    return (
        <Screen edges={[]} background="canvas">
            <View style={styles.flex}>
                {/* Map with a centred pin */}
                <View style={[styles.map, { height: mapHeight }]}>
                    <MapComponent
                        region={region}
                        selectedLocation={selectedLocation}
                        addressDetails={addressDetails}
                        isLoading={isLoading}
                        onMapPress={handleMapPress}
                        onRegionChangeComplete={handleRegionChangeComplete}
                        onCurrentLocationPress={handleCurrentLocationPress}
                        hint={isHi ? 'पिन को खिसकाकर सही करें' : 'Move pin to adjust'}
                        title={isHi ? 'आपका ऑर्डर यहाँ आएगा' : 'Your order will be delivered here'}
                    />
                </View>

                {/* Form card — enters with the screen, rides the keyboard */}
                <Animated.View style={[styles.sheet, sheetLift]}>
                    <Animated.View style={[styles.flex, enter]}>
                    <ScrollView
                        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.lg }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        automaticallyAdjustKeyboardInsets={false}
                    >
                        <View style={styles.handle} />
                        {editAddress ? (
                            <Text variant="h2" accessibilityRole="header">{isHi ? 'पता संपादित करें' : 'Edit address'}</Text>
                        ) : (
                            <Text variant="h2" accessibilityRole="header">{isHi ? 'पते का विवरण' : 'Address details'}</Text>
                        )}

                        <ContentSwap stateKey={isServiceable ? 'ok' : 'out'}>
                            {isServiceable ? (
                                <View style={styles.serviceable}>
                                    <MaterialCommunityIcons name="moped" size={18} color={colors.inkSecondary} />
                                    <Text variant="label" weight="medium" color="secondary" style={styles.flex}>
                                        {isHi ? 'डिलीवरी ' : 'Delivery in '}
                                        <Text variant="label" weight="bold" color="ink">{isHi ? `${serviceArea.etaMinutes} मिनट में` : `${serviceArea.etaMinutes} mins`}</Text>
                                        {distanceKm != null ? (isHi ? ` · स्टोर से ${distanceKm} किमी` : ` · ${distanceKm} km from store`) : ''}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.unserviceable}>
                                    <EmptyState
                                        compact
                                        mood="sad"
                                        title={isHi ? 'हम यहाँ अभी डिलीवर नहीं करते' : "We don't deliver here yet"}
                                        subtitle={isHi
                                            ? `यह स्थान स्टोर से ${distanceKm} किमी दूर है। ${serviceArea.radiusKm} किमी के भीतर पिन रखें।`
                                            : `This spot is ${distanceKm} km from our store. Move the pin within ${serviceArea.radiusKm} km.`}
                                    />
                                </View>
                            )}
                        </ContentSwap>

                        <View style={styles.types} accessibilityRole="radiogroup">
                            {ADDRESS_TYPES.map((t) => (
                                <Chip
                                    key={t.id}
                                    label={isHi ? t.hi : t.en}
                                    selected={addressType === t.id}
                                    onPress={() => setAddressType(t.id)}
                                    leftIcon={({ color, size }) => <MaterialCommunityIcons name={t.icon} size={size} color={color} />}
                                />
                            ))}
                        </View>

                        <FloatingInput
                            label={isHi ? 'मकान / फ्लैट / मंज़िल (वैकल्पिक)' : 'House / flat / floor (optional)'}
                            value={house}
                            onChangeText={setHouse}
                            autoCapitalize="words"
                            returnKeyType="next"
                            maxLength={100}
                        />
                        <FloatingInput
                            label={isHi ? 'क्षेत्र / सड़क / इलाका' : 'Area / street / locality'}
                            value={addressDetails.address}
                            onChangeText={setField('address')}
                            error={errors.address}
                            autoCapitalize="words"
                            maxLength={380}
                        />
                        <View style={styles.pair}>
                            <FloatingInput
                                label={isHi ? 'शहर' : 'City'}
                                value={addressDetails.city}
                                onChangeText={setField('city')}
                                error={errors.city}
                                autoCapitalize="words"
                                maxLength={100}
                                style={styles.flex}
                            />
                            <FloatingInput
                                label={isHi ? 'पिनकोड' : 'Pincode'}
                                value={String(addressDetails.pincode || '')}
                                onChangeText={setField('pincode')}
                                error={errors.pincode}
                                keyboardType="number-pad"
                                maxLength={6}
                                style={styles.flex}
                            />
                        </View>

                        <SaveButton
                            label={isServiceable
                                ? (isHi ? 'पता सहेजें' : 'Save address')
                                : (isHi ? 'यहाँ डिलीवरी उपलब्ध नहीं' : 'Not deliverable here')}
                            loading={isSaving}
                            done={saved}
                            doneLabel={isHi ? 'सहेजा गया' : 'Saved'}
                            disabled={!isServiceable || isSaving}
                            onPress={handleConfirmLocation}
                        />
                        <Animated.View style={keyboardRoom} />
                    </ScrollView>
                    </Animated.View>
                </Animated.View>

                {/* Back + search float over the map */}
                <View style={[styles.topBar, { paddingTop: insets.top + space.sm }, { pointerEvents: 'box-none' }]}>
                    <IconButton name="arrow-left" variant="glass" size="lg" accessibilityLabel={isHi ? 'वापस जाएं' : 'Go back'} onPress={handleBack} />
                    <GlassSurface radius="input" style={styles.search}>
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.inkSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={isHi ? 'क्षेत्र, सड़क या लैंडमार्क खोजें' : 'Search area, street, landmark'}
                            placeholderTextColor={colors.inkMuted}
                            selectionColor={colors.brand}
                            keyboardAppearance={isDark ? 'dark' : 'light'}
                            value={searchText}
                            onChangeText={setSearchText}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                            accessibilityLabel={isHi ? 'स्थान खोजें' : 'Search for a location'}
                        />
                        {searchText.length > 0 ? (
                            <IconButton
                                name="close"
                                size="sm"
                                variant="ghost"
                                accessibilityLabel={isHi ? 'खोज साफ़ करें' : 'Clear search'}
                                onPress={handleClearSearch}
                            />
                        ) : null}
                    </GlassSurface>
                </View>

                {isSearching ? (
                    <Animated.View
                        entering={layout.enterDown}
                        exiting={layout.exit}
                        style={[styles.results, { top: insets.top + space.sm + 48 + space.md }, { pointerEvents: 'box-none' }]}
                    >
                        <PlaceSuggestions
                            loading={isSearchingLoading}
                            items={suggestions}
                            onSelect={handleSelectSuggestion}
                            distanceKm={serviceArea.distanceKm}
                            radiusKm={serviceArea.radiusKm}
                            isHi={isHi}
                        />
                    </Animated.View>
                ) : null}
            </View>
        </Screen>
    );
};

export default AddAddressScreen;

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    map: { width: '100%', backgroundColor: t.colors.surfaceSunken },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: z.header,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.lg,
    },
    search: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 48,
        paddingLeft: space.lg,
        paddingRight: space.xs,
        ...t.shadows.md,
    },
    searchInput: { flex: 1, ...type.body, color: t.colors.ink, paddingVertical: space.sm, outlineStyle: 'none' },
    results: {
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: 0,
        zIndex: z.overlay,
    },
    sheet: {
        flex: 1,
        marginTop: -space['2xl'],
        backgroundColor: t.colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        ...t.shadows.floating,
    },
    sheetContent: { padding: space.lg, paddingTop: space.sm, gap: space.lg },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: radii.pill,
        backgroundColor: t.colors.border,
        marginBottom: space.xs,
    },
    serviceable: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    unserviceable: { borderRadius: radii.card, backgroundColor: t.colors.surfaceSunken, paddingVertical: space.sm },
    types: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
    pair: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
}));
