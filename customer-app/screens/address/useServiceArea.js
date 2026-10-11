import { useCallback, useMemo } from 'react';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { haversineKm } from './addressUtils';

// Geometry used until GET /settings/store answers (or if it fails): the pin check stays usable and
// the server re-validates the address. The delivery time has NO fallback: it is shown only when the
// store settings provide it.
const FALLBACK = {
    store: { latitude: 26.7588, longitude: 83.37 },
    radiusKm: 10,
};

/**
 * Store location + delivery radius from the store settings, with distance and
 * serviceability helpers. `distanceKm(point)` is null when the point has no coords.
 * `etaMinutes` is the store's estimatedDeliveryMinutes, or null while unknown.
 */
export function useServiceArea() {
    const { settings } = useStoreSettings();
    const area = useMemo(() => {
        const lat = Number(settings?.location?.latitude);
        const lng = Number(settings?.location?.longitude);
        const eta = Number(settings?.estimatedDeliveryMinutes);
        return {
            store: Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : FALLBACK.store,
            radiusKm: Number(settings?.serviceRadiusKm) || FALLBACK.radiusKm,
            etaMinutes: Number.isFinite(eta) && eta > 0 ? eta : null,
            isOpen: settings?.isOpen !== false,
        };
    }, [settings]);

    const distanceKm = useCallback((point) => {
        const lat = point?.latitude ?? point?.coords?.latitude;
        const lng = point?.longitude ?? point?.coords?.longitude;
        if (!lat || !lng) return null;
        return haversineKm(area.store, { latitude: lat, longitude: lng });
    }, [area]);

    const isServiceable = useCallback((point) => {
        const d = distanceKm(point);
        return d === null ? true : d <= area.radiusKm;
    }, [area, distanceKm]);

    return { ...area, distanceKm, isServiceable };
}
