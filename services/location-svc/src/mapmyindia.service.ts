import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

interface MapMyIndiaRouteResponse {
  routes?: Array<{
    geometry: string;
    distance: number;
    duration: number;
  }>;
  results?: Array<{
    distance: number;
    duration: number;
    geometry: string;
  }>;
}

interface MapMyIndiaDistanceResponse {
  results?: Array<{
    distance: number;
    duration: number;
  }>;
}

interface MapMyIndiaGeocodeResponse {
  results?: Array<{
    formatted_address: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  }>;
}

@Injectable()
export class MapMyIndiaService {
  private readonly logger = new Logger(MapMyIndiaService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl = 'https://apis.mapmyindia.com/advancedmap/v1';
  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAPMYINDIA_API_KEY');
    const restKey = this.configService.get<string>('MAPMYINDIA_REST_KEY');

    this.client = axios.create({
      baseURL: this.baseUrl,
      params: {
        api_key: apiKey,
        rest_key: restKey,
      },
      timeout: 10000,
    });
  }

  async calculateRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    polyline: string;
    distanceKm: number;
    durationSeconds: number;
  }> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.get<MapMyIndiaRouteResponse>('/route', {
          params: {
            step: 1,
            start: `${originLng},${originLat}`,
            end: `${destLng},${destLat}`,
          },
        });

        const route = response.data.routes?.[0] || response.data.results?.[0];
        if (!route) {
          throw new Error('No route found in response');
        }

        return {
          polyline: route.geometry,
          distanceKm: route.distance / 1000,
          durationSeconds: route.duration,
        };
      } catch (error) {
        this.logger.warn(`Route calculation attempt ${attempt} failed: ${error}`);
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw new Error('Route calculation failed after retries');
  }

  async calculateDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    distanceKm: number;
    durationSeconds: number;
  }> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.get<MapMyIndiaDistanceResponse>('/distance', {
            params: {
            region: 'IND',
            start: `${originLat},${originLng}`,
            end: `${destLat},${destLng}`,
          },
        });

        const result = response.data.results?.[0];
        if (!result) {
          throw new Error('No distance result found in response');
        }

        return {
          distanceKm: result.distance / 1000,
          durationSeconds: result.duration,
        };
      } catch (error) {
        this.logger.warn(`Distance calculation attempt ${attempt} failed: ${error}`);
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw new Error('Distance calculation failed after retries');
  }

  async geocode(address: string): Promise<{
    latitude: number;
    longitude: number;
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.get<MapMyIndiaGeocodeResponse>('/geocode', {
          params: { addr: address },
        });

        const result = response.data.results?.[0];
        if (!result) {
          throw new Error('No geocode result found in response');
        }

        return {
          latitude: result.lat,
          longitude: result.lng,
          formattedAddress: result.formatted_address,
          city: result.city,
          state: result.state,
          postalCode: result.pincode,
          country: result.country,
        };
      } catch (error) {
        this.logger.warn(`Geocoding attempt ${attempt} failed: ${error}`);
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw new Error('Geocoding failed after retries');
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<{
    formattedAddress: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }> {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.get<MapMyIndiaGeocodeResponse>('/reverse_geocode', {
          params: { latlng: `${latitude},${longitude}` },
        });

        const result = response.data.results?.[0];
        if (!result) {
          throw new Error('No reverse geocode result found in response');
        }

        return {
          formattedAddress: result.formatted_address,
          city: result.city,
          state: result.state,
          postalCode: result.pincode,
          country: result.country,
        };
      } catch (error) {
        this.logger.warn(`Reverse geocoding attempt ${attempt} failed: ${error}`);
        if (attempt === this.retryAttempts) {
          throw error;
        }
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw new Error('Reverse geocoding failed after retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
