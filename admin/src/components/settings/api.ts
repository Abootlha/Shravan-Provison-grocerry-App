import { useEffect, useState } from 'react';
import { http } from '@/lib/http';
import { getAdminUser } from '@/lib/session';

/** GET /settings/store (see docs/api/admin-api.md). */
export interface StoreSettings {
    storeName: string;
    location?: { latitude: number; longitude: number; address: string } | null;
    storeTimings?: { openTime: string; closeTime: string } | null;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
    gstin: string | null;
    timezone: string;
    fees: {
        deliveryFee: number;
        freeDeliveryThreshold: number;
        packagingFee: number;
        /** Fraction of the item total: 0.05 = 5%. */
        discountRate: number;
    };
    serviceRadiusKm: number;
    estimatedDeliveryMinutes: number;
    isActive: boolean;
    isOpen: boolean;
    nextOpenAt: string | null;
}

export type StoreSettingsUpdate = Partial<
    Omit<StoreSettings, 'isOpen' | 'nextOpenAt' | 'fees' | 'location' | 'storeTimings'> & {
        fees: Partial<StoreSettings['fees']>;
        location: { latitude: number; longitude: number; address: string };
        storeTimings: { openTime: string; closeTime: string };
    }
>;

export const fetchStoreSettings = (signal?: AbortSignal) => http.get<StoreSettings>('/settings/store', { signal });

export const saveStoreSettings = (body: StoreSettingsUpdate) =>
    http.post<{ message: string; settings: StoreSettings }>('/settings/store', body);

/** Settings, fees and the pause switch are admin-only on the backend. */
export function canEditSettings(): boolean {
    if (typeof window === 'undefined') return false;
    return (getAdminUser()?.role ?? 'admin') === 'admin';
}

/** Role check after mount (the role lives in localStorage, so it is unknown during SSR). */
export function useCanEditSettings(): boolean | null {
    const [canEdit, setCanEdit] = useState<boolean | null>(null);
    useEffect(() => setCanEdit(canEditSettings()), []);
    return canEdit;
}
