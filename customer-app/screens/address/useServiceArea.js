import { useCallback, useEffect, useState } from 'react';
import { SettingsService } from '../../services';
import { haversineKm } from './addressUtils';

// Used until GET /settings/store answers (or if it fails).
const FALLBACK = {
    store: { latitude: 26.7588, longitude: 83.37 },
    radiusKm: 10,
    etaMinutes: 10,
};

let cached = null;
let inflight = null;

const load = () => {
    if (cached) return Promise.resolve(cached);
    if (!inflight) {
        inflight = SettingsService.getStoreSettings()
            .then((s) => {
                const lat = Number(s?.location?.latitude);
                const lng = Number(s?.location?.longitude);
                cached = {
                    store: Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : FALLBACK.store,
                    radiusKm: Number(s?.serviceRadiusKm) || FALLBACK.radiusKm,
                    etaMinutes: Number(s?.estimatedDeliveryMinutes) || FALLBACK.etaMinutes,
                };
                return cached;
            })
            .catch(() => FALLBACK)
            .finally(() => { inflight = null; });
    }
    return inflight;
};

/**
 * Store location + delivery radius from the store settings, with distance and
 * serviceability helpers. `distanceKm(point)` is null when the point has no coords.
 */
export function useServiceArea() {
    const [area, setArea] = useState(cached || FALLBACK);

    useEffect(() => {
        let alive = true;
        load().then((a) => { if (alive) setArea(a); });
        return () => { alive = false; };
    }, []);

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
