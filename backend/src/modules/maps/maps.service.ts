import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly atlasBaseUrl = 'https://atlas.mappls.com/api/places';
  private readonly legacyBaseUrl = 'https://apis.mapmyindia.com/advancedmaps/v1';
  private readonly oauthUrl = 'https://outpost.mappls.com/api/security/oauth/token';
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('MAPMYINDIA_API_KEY') ||
      this.configService.get<string>('MAPPLS_API_KEY') ||
      '';
    this.clientId =
      this.configService.get<string>('MAPMYINDIA_CLIENT_ID') ||
      this.configService.get<string>('MAPPLS_CLIENT_ID') ||
      '';
    this.clientSecret =
      this.configService.get<string>('MAPMYINDIA_CLIENT_SECRET') ||
      this.configService.get<string>('MAPPLS_CLIENT_SECRET') ||
      '';
  }

  private ensureLegacyKey() {
    if (!this.apiKey) {
      throw new BadRequestException('Mappls legacy API key is not configured');
    }
  }

  private async getBearerHeaders() {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Mappls OAuth credentials are not configured');
    }

    if (!this.accessToken || Date.now() >= this.accessTokenExpiresAt) {
      const payload = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await axios.post(this.oauthUrl, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      this.accessToken = response.data?.access_token || null;
      const expiresIn = Number(response.data?.expires_in || 3600);
      this.accessTokenExpiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000;
    }

    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private async geocodeWithFallback(address: string) {
    const query = address.trim();
    const headers = await this.getBearerHeaders();
    const response = await axios.get(`${this.atlasBaseUrl}/geocode`, {
      headers,
      params: {
        address: query,
        itemCount: 1,
      },
      timeout: 10000,
    });

    const result = response.data?.copResults;
    if (!result) {
      return null;
    }

    const fallback = await this.lookupCoordinatesFallback(query);

    return {
      placeId: result.eLoc || query,
      formattedAddress: result.formattedAddress || query,
      latitude: fallback?.latitude ?? null,
      longitude: fallback?.longitude ?? null,
      houseNumber: result.houseNumber || '',
      houseName: result.houseName || '',
      street: result.street || '',
      city: result.city || result.subDistrict || '',
      district: result.district || '',
      state: result.state || '',
      pincode: result.pincode || '',
      country: 'India',
    };
  }

  private async lookupCoordinatesFallback(query: string) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'jsonv2',
          countrycodes: 'in',
          limit: 1,
        },
        headers: {
          'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
        },
        timeout: 10000,
      });

      const top = response.data?.[0];
      if (!top?.lat || !top?.lon) {
        return null;
      }

      return {
        latitude: parseFloat(top.lat),
        longitude: parseFloat(top.lon),
      };
    } catch (error) {
      this.logger.warn(`Coordinate fallback failed for "${query}"`);
      return null;
    }
  }

  async searchPlaces(query: string) {
    if (!query?.trim()) {
      throw new BadRequestException('Query is required');
    }

    const directGeocode = await this.geocodeWithFallback(query);
    if (directGeocode?.latitude && directGeocode?.longitude) {
      return {
        responseCode: 200,
        results: [directGeocode],
      };
    }

    const response = await axios.get(`${this.atlasBaseUrl}/search/json`, {
      headers: await this.getBearerHeaders(),
      params: {
        query: query.trim(),
        region: 'ind',
      },
      timeout: 10000,
    });

    const suggestions = response.data?.suggestedLocations || [];

    return {
      responseCode: 200,
      results: suggestions.map((result: any) => ({
        placeId: result.eLoc || result.placeName,
        formattedAddress: [result.placeName, result.placeAddress].filter(Boolean).join(', '),
        latitude: null,
        longitude: null,
        city: result.placeName || '',
        state: '',
        pincode: '',
        type: result.type || '',
        eloc: result.eLoc || '',
      })),
    };
  }

  async geocodeAddress(address: string) {
    if (!address?.trim()) {
      throw new BadRequestException('Address is required');
    }

    const result = await this.geocodeWithFallback(address);
    return {
      responseCode: result ? 200 : 404,
      results: result ? [result] : [],
    };
  }

  async reverseGeocode(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Valid latitude and longitude are required');
    }

    this.ensureLegacyKey();
    const response = await axios.get(`${this.legacyBaseUrl}/${this.apiKey}/rev_geocode`, {
      params: {
        lat: latitude,
        lng: longitude,
      },
      timeout: 10000,
    });

    return response.data;
  }
}
