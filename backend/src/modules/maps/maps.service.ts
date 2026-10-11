import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RedisService } from '../../common/utils/redis.service';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly googleMapsApiKey: string;
  private readonly atlasBaseUrl = 'https://atlas.mappls.com/api/places';
  private readonly legacyBaseUrl =
    'https://apis.mapmyindia.com/advancedmaps/v1';
  private readonly oauthUrl =
    'https://outpost.mappls.com/api/security/oauth/token';
  private readonly googlePlacesUrl =
    'https://maps.googleapis.com/maps/api/place';
  private readonly googleGeocodeUrl =
    'https://maps.googleapis.com/maps/api/geocode/json';
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly GEOCODE_CACHE_TTL = 3600; // 1 hour
  private readonly MAX_PLACE_DETAILS = 5; // cap paid Place Details fan-out per search

  // Store (delivery) centre — loaded from config dynamically. Used to bound searches so
  // cross-state/irrelevant results are never returned (like Zepto/Blinkit).
  private get storeLocation(): { latitude: number; longitude: number } {
    const lat = this.configService.get<number>('store.latitude') || 26.7588;
    const lng = this.configService.get<number>('store.longitude') || 83.37;
    return { latitude: lat, longitude: lng };
  }

  private get deliveryRadiusKm(): number {
    return this.configService.get<number>('store.maxDeliveryKm') || 15;
  }
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
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
    this.googleMapsApiKey =
      this.configService.get<string>('GOOGLE_MAPS_API_KEY') || '';
  }

  private ensureLegacyKey() {
    if (!this.apiKey) {
      throw new BadRequestException('Mappls legacy API key is not configured');
    }
  }

  private async getBearerHeaders() {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException(
        'Mappls OAuth credentials are not configured',
      );
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
      this.accessTokenExpiresAt =
        Date.now() + Math.max(expiresIn - 60, 60) * 1000;
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
        bounds: this.buildBoundingBox(
          near ?? this.storeLocation,
          this.deliveryRadiusKm + 10,
        ),
      },
      timeout: 10000,
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
      const response = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: query,
            format: 'jsonv2',
            countrycodes: 'in',
            limit: 3,
            viewbox: this.buildBoundingBox(centre, this.deliveryRadiusKm + 10),
            bounded: 1,
          },
          headers: {
            'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
          },
          timeout: 8000,
        },
      );

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
    } catch {
      this.logger.warn(`Coordinate fallback failed for "${query}"`);
      return null;
    }
  }

  async searchPlaces(
    query: string,
    near?: { latitude: number; longitude: number },
  ) {
    if (!query?.trim()) {
      throw new BadRequestException('Query is required');
    }

    const trimmedQuery = query.trim();
    const cacheKey = `search:${trimmedQuery.toLowerCase()}:${near?.latitude || 'default'}:${near?.longitude || 'default'}`;

    // Try to get from cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for query: "${trimmedQuery}"`);
        return JSON.parse(cached);
      }
    } catch {
      this.logger.warn('Cache read failed, proceeding with API calls');
    }

    const seenKeys = new Set<string>();

    // Try Google Maps first if API key is available
    let googleResults: any[] = [];
    if (
      this.googleMapsApiKey &&
      this.googleMapsApiKey !== 'your-google-maps-api-key-here'
    ) {
      try {
        googleResults = await this.searchGooglePlaces(trimmedQuery, near);
        if (googleResults.length > 0) {
          this.logger.debug(
            `Google Maps found ${googleResults.length} results for "${trimmedQuery}"`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Google Maps search failed for "${trimmedQuery}": ${error?.message}`,
        );
      }
    }

    // 1 & 2. Fetch from both providers in parallel to cut latency (as fallback)
    const [nominatimResults, mapplsResults] = await Promise.all([
      this.searchNominatim(trimmedQuery, near),
      this.searchMappls(trimmedQuery),
    ]);

    // Merge results, deduplicate by placeId (Google first, then fallbacks)
    const merged: any[] = [];
    for (const item of [
      ...googleResults,
      ...nominatimResults,
      ...mapplsResults,
    ]) {
      const key = item.placeId;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(item);
      }
    }

    // 3. Fallback: If no results found yet, use bounded direct geocode fallback
    if (merged.length === 0) {
      try {
        const directGeocode = await this.geocodeWithFallback(
          trimmedQuery,
          near,
        );
        if (directGeocode) {
          const coords = this.coordsOf(directGeocode);
          if (coords) {
            const parts = (directGeocode.formattedAddress || trimmedQuery)
              .split(',')
              .map((s: string) => s.trim());
            merged.push({
              ...directGeocode,
              name: parts[0] || trimmedQuery,
            });
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `Geocode fallback failed for "${trimmedQuery}": ${error?.message}`,
        );
      }
    }

    // 4. Enrich each result with distanceKm from store, sort by distance (closest first)
    const enriched = merged
      .map((item) => {
        const coords = this.coordsOf(item);
        const distanceKm = coords
          ? parseFloat(this.distanceKm(this.storeLocation, coords).toFixed(1))
          : null;
        return { ...item, distanceKm };
      })
      .filter((item) => {
        // Filter results within delivery radius
        if (item.distanceKm === null) return false;
        if (item.distanceKm > this.deliveryRadiusKm) return false;
        return true;
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    const result = {
      responseCode: 200,
      results: enriched,
    };

    // Cache the results
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(result),
        this.CACHE_TTL,
      );
      this.logger.debug(`Cached results for query: "${trimmedQuery}"`);
    } catch {
      this.logger.warn('Cache write failed');
    }

    return result;
  }

  private coordsOf(item: any): { latitude: number; longitude: number } | null {
    const lat = parseFloat(item?.latitude);
    const lng = parseFloat(item?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { latitude: lat, longitude: lng };
  }

  private withinDeliveryRadius(coords: {
    latitude: number;
    longitude: number;
  }) {
    return this.distanceKm(this.storeLocation, coords) <= this.deliveryRadiusKm;
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
      Math.cos(sLatA) *
        Math.cos(sLatB) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
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
      // Geographic bias: restrict results to a box around the user (or store).
      const centre = near ?? this.storeLocation;
      const viewbox = this.buildBoundingBox(centre, this.deliveryRadiusKm + 10);
      const nomRes = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q: query,
            format: 'jsonv2',
            countrycodes: 'in',
            limit: 15,
            addressdetails: 1,
            viewbox,
            bounded: 0,
          },
          headers: {
            'User-Agent': 'ShravanKirana/1.0 (maps proxy)',
          },
          timeout: 6000,
        },
      );

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
        const key =
          item.place_id?.toString() || `${lat.toFixed(4)}_${lon.toFixed(4)}`;

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
      this.logger.warn(
        `Nominatim multi-search failed for "${query}": ${error?.message}`,
      );
      return [];
    }
  }

  private async searchGooglePlaces(
    query: string,
    near?: { latitude: number; longitude: number },
  ): Promise<any[]> {
    if (!this.googleMapsApiKey) {
      return [];
    }

    try {
      const params: any = {
        input: query,
        key: this.googleMapsApiKey,
        fields: 'place_id,name,formatted_address,geometry,types',
      };

      // Add location bias for better results
      if (near?.latitude && near?.longitude) {
        const radius = 15000; // 15km radius
        params.location = `${near.latitude},${near.longitude}`;
        params.radius = radius;
      }

      // Restrict to India for better local results
      params.components = 'country:in';

      const response = await axios.get(
        `${this.googlePlacesUrl}/autocomplete/json`,
        {
          params,
          timeout: 6000,
        },
      );

      if (response.data.status !== 'OK' || !response.data.predictions) {
        this.logger.warn(`Google Places API returned: ${response.data.status}`);
        return [];
      }

      // Get detailed place information for each prediction
      const results = await Promise.all(
        response.data.predictions
          .slice(0, this.MAX_PLACE_DETAILS)
          .map(async (prediction: any) => {
            try {
              const placeDetails = await this.getGooglePlaceDetails(
                prediction.place_id,
              );
              return {
                placeId: prediction.place_id,
                name:
                  prediction.structured_formatting?.main_text ||
                  prediction.description.split(',')[0],
                formattedAddress: prediction.description,
                latitude: placeDetails?.latitude || null,
                longitude: placeDetails?.longitude || null,
                city: placeDetails?.city || '',
                state: placeDetails?.state || '',
                pincode: placeDetails?.pincode || '',
                type: prediction.types?.[0] || '',
              };
            } catch {
              // If details fail, return prediction without coordinates
              return {
                placeId: prediction.place_id,
                name:
                  prediction.structured_formatting?.main_text ||
                  prediction.description.split(',')[0],
                formattedAddress: prediction.description,
                latitude: null,
                longitude: null,
                city: '',
                state: '',
                pincode: '',
                type: prediction.types?.[0] || '',
              };
            }
          }),
      );

      return results.filter((result) => result.latitude && result.longitude);
    } catch (error: any) {
      this.logger.warn(
        `Google Places search failed for "${query}": ${error?.message}`,
      );
      return [];
    }
  }

  private async getGooglePlaceDetails(placeId: string) {
    try {
      const response = await axios.get(`${this.googlePlacesUrl}/details/json`, {
        params: {
          place_id: placeId,
          key: this.googleMapsApiKey,
          fields: 'geometry,formatted_address,address_components',
        },
        timeout: 4000,
      });

      if (response.data.status !== 'OK' || !response.data.result) {
        return null;
      }

      const result = response.data.result;
      const components = result.address_components || [];

      // Extract address components
      const getComponent = (types: string[]) => {
        return (
          components.find(
            (comp: any) =>
              comp.types &&
              comp.types.some((type: string) => types.includes(type)),
          )?.long_name || ''
        );
      };

      return {
        latitude: result.geometry?.location?.lat || null,
        longitude: result.geometry?.location?.lng || null,
        formattedAddress: result.formatted_address || '',
        city: getComponent(['locality', 'administrative_area_level_2']),
        state: getComponent(['administrative_area_level_1']),
        pincode: getComponent(['postal_code']),
      };
    } catch (error: any) {
      this.logger.warn(
        `Google Place Details failed for "${placeId}": ${error?.message}`,
      );
      return null;
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
        timeout: 6000,
      });

      const suggestions = response.data?.suggestedLocations || [];
      const results: any[] = [];

      for (const result of suggestions) {
        const placeName = result.placeName || query;
        const fullAddr = [result.placeName, result.placeAddress]
          .filter(Boolean)
          .join(', ');
        const key = result.eLoc || placeName;
        const lat = result.latitude ? parseFloat(result.latitude) : null;
        const lon = result.longitude ? parseFloat(result.longitude) : null;

        // Only include results that already have coordinates (skip slow fallback)
        if (lat && lon) {
          results.push({
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
      }

      return results;
    } catch (error: any) {
      this.logger.warn(
        `Mappls search failed for "${query}": ${error?.message}`,
      );
      return [];
    }
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisService.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch {
      this.logger.warn('Cache read failed, proceeding with API calls');
      return null;
    }
  }

  private async writeCache(key: string, value: unknown, ttl: number) {
    try {
      await this.redisService.set(key, JSON.stringify(value), ttl);
    } catch {
      this.logger.warn('Cache write failed');
    }
  }

  async geocodeAddress(address: string) {
    if (!address?.trim()) {
      throw new BadRequestException('Address is required');
    }

    const cacheKey = `geocode:${address.trim().toLowerCase()}`;
    const cached = await this.readCache<any>(cacheKey);
    if (cached) {
      return cached;
    }

    let result: Awaited<ReturnType<MapsService['geocodeWithFallback']>>;
    try {
      result = await this.geocodeWithFallback(address);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`Geocode failed: ${error?.message}`);
      throw new ServiceUnavailableException(
        'Geocoding service is temporarily unavailable',
      );
    }

    const response = {
      responseCode: result ? 200 : 404,
      results: result ? [result] : [],
    };
    if (result) {
      await this.writeCache(cacheKey, response, this.GEOCODE_CACHE_TTL);
    }
    return response;
  }

  async reverseGeocode(latitude: number, longitude: number) {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new BadRequestException(
        'Valid latitude and longitude are required',
      );
    }

    // ~1m precision is plenty for an address lookup and keeps the cache useful.
    const lat = Number(latitude.toFixed(5));
    const lng = Number(longitude.toFixed(5));
    const cacheKey = `revgeocode:${lat}:${lng}`;
    const cached = await this.readCache<any>(cacheKey);
    if (cached) {
      return cached;
    }

    this.ensureLegacyKey();
    try {
      const response = await axios.get(
        `${this.legacyBaseUrl}/${encodeURIComponent(this.apiKey)}/rev_geocode`,
        {
          params: { lat, lng },
          timeout: 10000,
        },
      );

      await this.writeCache(cacheKey, response.data, this.GEOCODE_CACHE_TTL);
      return response.data;
    } catch (error: any) {
      this.logger.warn(
        `Reverse geocode failed: ${error?.response?.status || error?.message}`,
      );
      throw new ServiceUnavailableException(
        'Reverse geocoding service is temporarily unavailable',
      );
    }
  }
}
