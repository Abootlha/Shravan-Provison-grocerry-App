import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LocationService } from './location.service';

interface GeoLocation {
  latitude: number;
  longitude: number;
}

interface CalculateRouteRequest {
  origin: GeoLocation;
  destination: GeoLocation;
}

interface CalculateRouteResponse {
  route: {
    points: GeoLocation[];
    distance_km: number;
    duration_seconds: number;
    polyline: string;
  };
}

interface CalculateETARequest {
  origin: GeoLocation;
  destination: GeoLocation;
}

interface CalculateETAResponse {
  eta: {
    duration_seconds: number;
    formatted: string;
    arrival_time: { seconds: number; nanos: number };
  };
}

interface GeocodeRequest {
  address: string;
}

interface GeocodeResponse {
  location: {
    geo_location: GeoLocation;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface ReverseGeocodeRequest {
  location: GeoLocation;
}

interface ReverseGeocodeResponse {
  location: {
    geo_location: GeoLocation;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

@Controller()
export class LocationGrpcController {
  constructor(private readonly locationService: LocationService) {}

  @GrpcMethod('LocationService', 'CalculateRoute')
  async calculateRoute(data: CalculateRouteRequest): Promise<CalculateRouteResponse> {
    const result = await this.locationService.calculateRoute(
      data.origin.latitude,
      data.origin.longitude,
      data.destination.latitude,
      data.destination.longitude,
    );

    return {
      route: {
        points: result.points,
        distance_km: result.distance_km,
        duration_seconds: result.duration_seconds,
        polyline: result.polyline,
      },
    };
  }

  @GrpcMethod('LocationService', 'CalculateETA')
  async calculateETA(data: CalculateETARequest): Promise<CalculateETAResponse> {
    const result = await this.locationService.calculateETA(
      data.origin.latitude,
      data.origin.longitude,
      data.destination.latitude,
      data.destination.longitude,
    );

    return {
      eta: {
        duration_seconds: result.duration_seconds,
        formatted: result.formatted,
        arrival_time: {
          seconds: Math.floor(result.arrival_time.getTime() / 1000),
          nanos: 0,
        },
      },
    };
  }

  @GrpcMethod('LocationService', 'Geocode')
  async geocode(data: GeocodeRequest): Promise<GeocodeResponse> {
    const result = await this.locationService.geocode(data.address);

    return {
      location: {
        geo_location: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
        address: result.formattedAddress,
        city: result.city || '',
        state: result.state || '',
        postal_code: result.postalCode || '',
        country: result.country || '',
      },
    };
  }

  @GrpcMethod('LocationService', 'ReverseGeocode')
  async reverseGeocode(data: ReverseGeocodeRequest): Promise<ReverseGeocodeResponse> {
    const result = await this.locationService.reverseGeocode(
      data.location.latitude,
      data.location.longitude,
    );

    return {
      location: {
        geo_location: {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        },
        address: result.formattedAddress,
        city: result.city || '',
        state: result.state || '',
        postal_code: result.postalCode || '',
        country: result.country || '',
      },
    };
  }
}
