import { http } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';

export type RiderStatus = 'available' | 'busy' | 'offline';

export const VEHICLE_TYPES = ['Two Wheeler', 'Electric Bike', 'Bicycle', 'Three Wheeler', 'Four Wheeler'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface RiderStats {
    deliveredCount: number;
    cancelledCount: number;
    activeOrderCount: number;
    deliveredToday: number;
    lastDeliveredAt: string | null;
}

export interface Rider {
    _id: string;
    name: string;
    username: string;
    phone: string;
    vehicleType: VehicleType;
    status: RiderStatus;
    isActive: boolean;
    rating?: number;
    totalRatings?: number;
    totalDeliveries?: number;
    lastLocationUpdate?: string | null;
    lastActiveAt?: string | null;
    createdAt: string;
    updatedAt: string;
    stats?: RiderStats;
}

export interface RidersSummary {
    total: number;
    active: number;
    inactive: number;
    available: number;
    busy: number;
}

export interface RidersResponse {
    riders: Rider[];
    summary: RidersSummary;
}

export interface RiderActiveOrder {
    _id: string;
    orderId: string;
    orderStatus: string;
    totalAmount: number;
    createdAt: string;
    updatedAt: string;
}

export interface RiderStatsResponse extends RiderStats {
    riderId: string;
    activeOrders: RiderActiveOrder[];
}

/** The whole roster: the endpoint is not paginated and the summary covers every rider. */
export const ridersListKey = queryKeys.riders.list({});
export const fetchRiders = () => http.get<RidersResponse>('/admin/riders');
export const invalidateRiders = () => queryClient.invalidateQueries({ queryKey: queryKeys.riders.all });

/** The status the table shows: deactivated riders read as such whatever their last status. */
export const displayStatus = (rider: Pick<Rider, 'isActive' | 'status'>) => (rider.isActive ? rider.status : 'inactive');

/** "+919000012345" → "+91 90000 12345". Leaves anything unexpected untouched. */
export function formatPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 10 ? digits : null;
    return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

/** 10-digit local part for editing. */
export const localPhone = (phone: string | null | undefined) => {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

/** A rating is only shown when customers actually rated the rider. */
export const hasRealRating = (rider: Rider) => (rider.totalRatings ?? 0) > 0 && (rider.rating ?? 0) > 0;
