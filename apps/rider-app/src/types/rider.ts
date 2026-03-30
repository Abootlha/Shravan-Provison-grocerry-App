export interface Rider {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photo?: string;
  vehicle: {
    type: 'bike' | 'scooter' | 'cycle';
    number?: string;
    make?: string;
    model?: string;
  };
  documents: {
    aadhar?: string;
    drivingLicense?: string;
    rcBook?: string;
  };
  isOnline: boolean;
  rating: number;
  totalDeliveries: number;
  totalEarnings?: number;
  totalOrders?: number;
  acceptanceRate: number;
  createdAt: string;
}

export interface RiderStats {
  todayDeliveries: number;
  todayEarnings: number;
  weekDeliveries: number;
  weekEarnings: number;
  monthDeliveries: number;
  monthEarnings: number;
  rating: number;
  acceptanceRate: number;
}

export interface RiderLocation {
  riderId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  heading?: number;
  speed?: number;
  timestamp: string;
}
