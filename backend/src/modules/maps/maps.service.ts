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

    const trimmedQuery = query.trim();
    const results: any[] = [];
    const seenKeys = new Set<string>();

    // 1 & 2. Fetch from both providers in parallel to cut latency.
    const [nominatimResults, mapplsResults] = await Promise.all([
      this.searchNominatim(trimmedQuery),
      this.searchMappls(trimmedQuery),
    ]);

    for (const item of [...nominatimResults, ...mapplsResults]) {
      const key = item.placeId;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(item);
      }
    }

    // 3. Fallback: If no results found yet, use direct geocode fallback
    if (results.length === 0) {
      try {
        const directGeocode = await this.geocodeWithFallback(trimmedQuery);
        if (directGeocode?.latitude && directGeocode?.longitude) {
          const parts = (directGeocode.formattedAddress || trimmedQuery).split(',').map((s: string) => s.trim());
          results.push({
            ...directGeocode,
            name: parts[0] || trimmedQuery,
          });
        }
      } catch (error: any) {
        this.logger.warn(`Geocode fallback failed for "${trimmedQuery}": ${error?.message}`);
      }
    }

    return {
      responseCode: 200,
      results,
    };
  }

  private async searchNominatim(query: string): Promise<any[]> {
    try {
      const nomRes = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'jsonv2',
          countrycodes: 'in',
          limit: 10,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
        },
        timeout: 8000,
      });

      if (!Array.isArray(nomRes.data)) {
        return [];
      }

      const results: any[] = [];
      for (const item of nomRes.data) {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const displayName = item.display_name || '';

        if (!displayName) continue;

        const parts = displayName.split(',').map((s: string) => s.trim());
        const placeName = parts[0] || query;
        const key = item.place_id?.toString() || `${lat.toFixed(4)}_${lon.toFixed(4)}`;

        results.push({
          placeId: key,
          name: placeName,
          formattedAddress: displayName,
          latitude: lat,
          longitude: lon,
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.suburb ||
            item.address?.county ||
            item.address?.state_district ||
            'Gorakhpur',
          state: item.address?.state || 'Uttar Pradesh',
          pincode: item.address?.postcode || '',
          type: item.type || 'place',
        });
      }
      return results;
    } catch (error: any) {
      this.logger.warn(`Nominatim multi-search failed for "${query}": ${error?.message}`);
      return [];
    }
  }

  private async searchMappls(query: string): Promise<any[]> {
    if (!this.clientId || !this.clientSecret) {
      return [];
    }

    try {
      const headers = await this.getBearerHeaders();
      const response = await axios.get(`${this.atlasBaseUrl}/search/json`, {
        headers,
        params: {
          query,
          region: 'ind',
        },
        timeout: 8000,
      });

      const suggestions = response.data?.suggestedLocations || [];
      const entries: Array<{
        placeId: string;
        name: string;
        fullAddr: string;
        eloc: string;
        type: string;
        lat: number | null;
        lon: number | null;
      }> = [];

      for (const result of suggestions) {
        const placeName = result.placeName || query;
        const fullAddr = [result.placeName, result.placeAddress].filter(Boolean).join(', ');
        const key = result.eLoc || placeName;
        const lat = result.latitude ? parseFloat(result.latitude) : null;
        const lon = result.longitude ? parseFloat(result.longitude) : null;
        entries.push({
          placeId: key,
          name: placeName,
          fullAddr: fullAddr || placeName,
          eloc: result.eLoc || '',
          type: result.type || '',
          lat,
          lon,
        });
      }

      // Resolve missing coordinates for all items in parallel (big latency win).
      await Promise.allSettled(
        entries.map(async (entry) => {
          if (entry.lat && entry.lon) return;
          const coords = await this.lookupCoordinatesFallback(entry.fullAddr);
          if (coords) {
            entry.lat = coords.latitude;
            entry.lon = coords.longitude;
          }
        })
      );

      return entries.map((entry) => ({
        placeId: entry.placeId,
        name: entry.name,
        formattedAddress: entry.fullAddr,
        latitude: entry.lat,
        longitude: entry.lon,
        city: entry.name,
        state: '',
        pincode: '',
        type: entry.type,
        eloc: entry.eloc,
      }));
    } catch (error: any) {
      this.logger.warn(`Mappls search failed for "${query}": ${error?.message}`);
      return [];
    }
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
