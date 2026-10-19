/**
 * The onboarding delivery-location step: ask for the location, find the address, check it against the
 * store's delivery radius (GET /settings/store via useServiceArea) and keep it in Redux.
 *
 *   const loc = useDeliveryLocation();
 *   loc.status   'idle' | 'locating' | 'inArea' | 'outOfArea' | 'denied' | 'error'
 *   loc.place    { latitude, longitude, address, city, pincode } | null — the checked point
 *   loc.distanceKm  km from the store, or null
 *   loc.locate()            permission → GPS fix → reverse geocode → check
 *   loc.pickPlace(address)   check an address picked elsewhere (the Location screen)
 *   loc.area                useServiceArea(): { store, radiusKm, etaMinutes, ... }
 *
 * Redux (locationSlice, unchanged): the GPS point goes to setCurrentLocation in the same shape the
 * Location screen uses; it also becomes the selected address when a street address was found
 * (no invented addresses, same rule as LocationScreen).
 */
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import * as Location from 'expo-location';
import { reverseGeocode } from '../../services';
import { setCurrentLocation, setLocationEnabled, setSelectedAddress } from '../../store/slices/locationSlice';
import { useServiceArea } from '../address/useServiceArea';

const FIX_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function addressFor(latitude, longitude) {
    try {
        const r = await reverseGeocode(latitude, longitude);
        if (r) {
            const line = r.formattedAddress || [r.houseNumber, r.houseName, r.street].filter(Boolean).join(', ');
            if (line) return { address: line, city: r.city || '', pincode: r.pincode || '' };
        }
    } catch (e) {
        // fall through to the device geocoder
    }
    if (Platform.OS === 'web') return null; // expo-location has no reverse geocoder on web
    try {
        const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const line = a ? [a.name, a.street, a.district].filter(Boolean).join(', ') : '';
        if (line) return { address: line, city: a.city || a.subregion || '', pincode: a.postalCode || '' };
    } catch (e) {
        // no address: the point is still usable for the delivery check
    }
    return null;
}

export function useDeliveryLocation({ isHi } = {}) {
    const dispatch = useDispatch();
    const area = useServiceArea();
    const [status, setStatus] = useState('idle');
    const [place, setPlace] = useState(null);

    const check = useCallback(
        (p) => {
            setPlace(p);
            setStatus(area.isServiceable(p) ? 'inArea' : 'outOfArea');
        },
        [area],
    );

    const locate = useCallback(async () => {
        setStatus('locating');
        try {
            const perm = await Location.requestForegroundPermissionsAsync();
            if (perm?.status !== 'granted') {
                setStatus('denied');
                return;
            }
            const fix = await withTimeout(
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                FIX_TIMEOUT_MS,
            );
            const { latitude, longitude } = fix.coords;
            const found = await addressFor(latitude, longitude);
            const loc = {
                id: `current-${Date.now()}`,
                type: isHi ? 'वर्तमान स्थान' : 'Current Location',
                address: found?.address || '',
                city: found?.city || '',
                pincode: found?.pincode || '',
                isDefault: false,
                latitude,
                longitude,
                coords: { latitude, longitude },
            };
            dispatch(setCurrentLocation(loc));
            if (found) dispatch(setSelectedAddress(loc));
            dispatch(setLocationEnabled(true));
            check(loc);
        } catch (e) {
            if (__DEV__) console.warn('[onboarding] location failed', e?.message);
            setStatus('error');
        }
    }, [check, dispatch, isHi]);

    const pickPlace = useCallback(
        (addr) => {
            const latitude = Number(addr?.latitude ?? addr?.coords?.latitude);
            const longitude = Number(addr?.longitude ?? addr?.coords?.longitude);
            if (!latitude || !longitude) return;
            check({ ...addr, latitude, longitude });
        },
        [check],
    );

    return { status, place, distanceKm: place ? area.distanceKm(place) : null, locate, pickPlace, area };
}

export default useDeliveryLocation;
