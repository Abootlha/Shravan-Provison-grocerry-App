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

  // Store (delivery) centre — Gorakhpur by default. Used to bound searches so
  // cross-state/irrelevant results are never returned (like Zepto/Blinkit).
  private get storeLocation(): { latitude: number; longitude: number } {
    const lat = parseFloat(
      this.configService.get<string>('STORE_LATITUDE') || '26.7588',
    );
    const lng = parseFloat(
      this.configService.get<string>('STORE_LONGITUDE') || '83.3700',
    );
    return { latitude: lat, longitude: lng };
  }

  private get deliveryRadiusKm(): number {
    return parseFloat(
      this.configService.get<string>('STORE_MAX_DELIVERY_KM') || '10',
    );
  }
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

  private async geocodeWithFallback(
    address: string,
    near?: { latitude: number; longitude: number },
  ) {
    const query = address.trim();
    const headers = await this.getBearerHeaders();
    const response = await axios.get(`${this.atlasBaseUrl}/geocode`, {
      headers,
      params: {
        address: query,
        itemCount: 1,
        bounds: this.buildBoundingBox(near ?? this.storeLocation, this.deliveryRadiusKm + 5),
      },
      timeout: 8000,
    });

    const result = response.data?.copResults;
    if (!result) {
      return null;
    }

    const fallback = await this.lookupCoordinatesFallback(query, near);

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

  private async lookupCoordinatesFallback(
    query: string,
    near?: { latitude: number; longitude: number },
  ) {
    try {
      const centre = near ?? this.storeLocation;
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'jsonv2',
          countrycodes: 'in',
          limit: 1,
          viewbox: this.buildBoundingBox(centre, this.deliveryRadiusKm + 5),
          bounded: 1,
        },
        headers: {
          'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
        },
        timeout: 6000,
      });

      const top = response.data?.[0];
      if (!top?.lat || !top?.lon) {
        return null;
      }

      const coords = {
        latitude: parseFloat(top.lat),
        longitude: parseFloat(top.lon),
      };
      if (!this.withinDeliveryRadius(coords)) {
        return null;
      }
      return coords;
    } catch (error) {
      this.logger.warn(`Coordinate fallback failed for "${query}"`);
      return null;
    }
  }

  private searchCache = new Map<string, { timestamp: number; data: any }>();

  async searchPlaces(query: string, near?: { latitude: number; longitude: number }) {
    if (!query?.trim()) {
      throw new BadRequestException('Query is required');
    }

    const trimmedQuery = query.trim().toLowerCase();
    const cacheKey = `search_${trimmedQuery}_${near ? `${near.latitude}_${near.longitude}` : 'store'}`;

    // 1. Return cached result if available (valid for 5 minutes)
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300,000) {
      return cached.data;
    }

    const seenKeys = new Set<string>();

    // 2. Fetch from Nominatim and Mappls in parallel with tight timeouts
    const [nominatimResults, mapplsResults] = await Promise.all([
      this.searchNominatim(trimmedQuery, near),
      this.searchMappls(trimmedQuery),
    ]);

    // Merge results, deduplicate by placeId
    const merged: any[] = [];
    for (const item of [...nominatimResults, ...mapplsResults]) {
      const key = item.placeId;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(item);
      }
    }

    // 3. Enrich each result with distanceKm from store, sort by distance (closest first)
    const enriched = merged
      .map((item) => {
        const coords = this.coordsOf(item);
        const distanceKm = coords
          ? parseFloat(this.distanceKm(this.storeLocation, coords).toFixed(1))
          : null;
        return { ...item, distanceKm };
      })
      .filter((item) => item.distanceKm !== null)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    const response = {
      responseCode: 200,
      results: enriched,
    };

    // Cache the response
    if (enriched.length > 0) {
      this.searchCache.set(cacheKey, { timestamp: Date.now(), data: response });
      if (this.searchCache.size > 200) {
        const firstKey = this.searchCache.keys().next().value;
        if (firstKey) this.searchCache.delete(firstKey);
      }
    }

    return response;
  }

  private coordsOf(item: any): { latitude: number; longitude: number } | null {
    const lat = parseFloat(item?.latitude);
    const lng = parseFloat(item?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  }

  private withinDeliveryRadius(coords: { latitude: number; longitude: number }) {
    return (
      this.distanceKm(this.storeLocation, coords) <= this.deliveryRadiusKm
    );
  }

  private distanceKm(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const sLatA = (a.latitude * Math.PI) / 180;
    const sLatB = (b.latitude * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(sLatA) * Math.cos(sLatB) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  private buildBoundingBox(
    centre: { latitude: number; longitude: number },
    radiusKm: number,
  ) {
    const kmPerDeg = 111;
    const offset = Math.max(radiusKm, 1) / kmPerDeg;
    const minLat = centre.latitude - offset;
    const maxLat = centre.latitude + offset;
    const offsetLon = offset / Math.cos((centre.latitude * Math.PI) / 180);
    const minLon = centre.longitude - offsetLon;
    const maxLon = centre.longitude + offsetLon;
    return `${minLon},${minLat},${maxLon},${maxLat}`;
  }

  private async searchNominatim(
    query: string,
    near?: { latitude: number; longitude: number },
  ): Promise<any[]> {
    try {
      const centre = near ?? this.storeLocation;
      const viewbox = this.buildBoundingBox(centre, this.deliveryRadiusKm + 5);

      const hasRegion = /gorakhpur|uttar pradesh|u\.p\.|deoria|kushinagar|basti|maharajganj/i.test(query);
      const queryList = hasRegion ? [query] : [`${query}, Gorakhpur, Uttar Pradesh`, query];

      // Run query variants IN PARALLEL with 2s timeout
      const responses = await Promise.allSettled(
        queryList.map((q) =>
          axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
              q,
              format: 'jsonv2',
              countrycodes: 'in',
              limit: 8,
              addressdetails: 1,
              viewbox,
              bounded: 0,
            },
            headers: {
              'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
            },
            timeout: 2000,
          }),
        ),
      );

      const allResults: any[] = [];
      const seenIds = new Set<string>();

      for (const res of responses) {
        if (res.status === 'fulfilled' && Array.isArray(res.value?.data)) {
          for (const item of res.value.data) {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const displayName = item.display_name || '';

            if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

            const parts = displayName.split(',').map((s: string) => s.trim());
            const placeName = parts[0] || query;
            const key = item.place_id?.toString() || `${lat.toFixed(4)}_${lon.toFixed(4)}`;

            if (!seenIds.has(key)) {
              seenIds.add(key);
              allResults.push({
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
          }
        }
      }

      return allResults;
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
          location: `${this.storeLocation.latitude},${this.storeLocation.longitude}`,
          region: 'ind',
        },
        timeout: 2000,
      });

      const suggestions = response.data?.suggestedLocations || [];
      const entries: any[] = [];

      for (const result of suggestions) {
        const placeName = result.placeName || query;
        const fullAddr = [result.placeName, result.placeAddress].filter(Boolean).join(', ');
        const key = result.eLoc || placeName;
        const lat = result.latitude ? parseFloat(result.latitude) : null;
        const lon = result.longitude ? parseFloat(result.longitude) : null;

        entries.push({
          placeId: key,
          name: placeName,
          formattedAddress: fullAddr || placeName,
          latitude: lat,
          longitude: lon,
          city: placeName,
          state: '',
          pincode: '',
          type: result.type || '',
          eloc: result.eLoc || '',
        });
      }

      // Parallel coordinate resolution for items missing lat/lon with tight timeout
      const missingCoordItems = entries.filter((e) => !e.latitude || !e.longitude);
      if (missingCoordItems.length > 0) {
        await Promise.allSettled(
          missingCoordItems.slice(0, 3).map(async (item) => {
            const fallback = await this.lookupCoordinatesFallback(item.formattedAddress);
            if (fallback) {
              item.latitude = fallback.latitude;
              item.longitude = fallback.longitude;
            }
          }),
        );
      }

      return entries.filter((e) => e.latitude && e.longitude);
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
