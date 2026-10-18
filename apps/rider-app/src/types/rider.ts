export const VEHICLE_TYPES = ['Two Wheeler', 'Electric Bike', 'Bicycle', 'Three Wheeler', 'Four Wheeler'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type RiderStatus = 'available' | 'busy' | 'offline';

export interface Rider {
  id: string;
  name: string;
  username?: string;
  phone: string;
  vehicleType?: string;
  vehicleNumber?: string;
  status: RiderStatus;
  /** available or busy. Mirrors the server, never assumed locally. */
  isOnline: boolean;
  isActive?: boolean;
  rating: number;
  totalDeliveries: number;
  createdAt?: string;
}

export interface PeriodMetrics {
  deliveries: number;
  earnings: number;
}

export interface RiderMetrics {
  totalDeliveries: number;
  avgRating: number;
  acceptanceRate: number;
  currency: string;
  timezone?: string;
  earningsBasis?: string;
  today: PeriodMetrics;
  week: PeriodMetrics;
  month: PeriodMetrics;
}

export interface LiveLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}
