export interface IRiderLocation {
  type: string;
  coordinates: number[];
}

export interface IRiderStats {
  totalDeliveries: number;
  avgRating: number;
  acceptanceRate: number;
}

export interface IRider {
  _id: string | any;
  userId: string | any;
  currentLocation: IRiderLocation;
  lastLocationUpdate: Date;
  heading: number;
  speed: number;
  isAvailable: boolean;
  isOnline: boolean;
  stats: IRiderStats;
  vehicleType: 'motorcycle' | 'car' | 'bicycle';
  createdAt: Date;
  updatedAt: Date;
}

export interface INearbyRiderQuery {
  longitude: number;
  latitude: number;
  radiusInMeters?: number;
  limit?: number;
  availableOnly?: boolean;
  onlineOnly?: boolean;
}
