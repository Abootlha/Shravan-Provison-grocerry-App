import { MAPMYINDIA_CONFIG } from './config';
import { API_BASE_URL } from './config';
import Constants from 'expo-constants';

const MAPMYINDIA_API_KEY = MAPMYINDIA_CONFIG.apiKey;
const MAPS_PROXY_URL = `${API_BASE_URL}/maps`;
const GEOCODE_URL = `${MAPS_PROXY_URL}/geocode`;
const REVERSE_GEOCODE_URL = `${MAPS_PROXY_URL}/reverse-geocode`;
const SEARCH_URL = `${MAPS_PROXY_URL}/search`;

// Google Maps API
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY ||
                            Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
                            Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
                            process.env.GOOGLE_MAPS_API_KEY ||
                            '';

const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place';
const GOOGLE_GEOCODE_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export async function geocodeAddress(address) {
    if (!address) {
        return null;
    }

    // Try Google Maps Geocoding first if API key is available
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        try {
            const googleResult = await geocodeWithGoogle(address);
            if (googleResult) {
                return googleResult;
            }
        } catch (error) {
            console.warn('Google Maps geocoding failed, falling back to backend:', error);
        }
    }

    // Fallback to backend proxy (MapMyIndia/Nominatim)
    try {
        const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('MapMyIndia Geocoding API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.responseCode !== 200 || !data.results || !data.results.length) {
            return null;
        }

        const result = data.results[0];
        return {
            formattedAddress: result.formattedAddress || result.location,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lng),
            houseNumber: result.houseNumber || '',
            houseName: result.HOUSE_NAME || '',
            street: result.street || '',
            city: result.city || '',
            district: result.district || '',
            state: result.state || '',
            pincode: result.pincode || '',
            country: result.country || 'India',
        };
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

// Google Maps Geocoding
async function geocodeWithGoogle(address) {
    try {
        const params = new URLSearchParams({
            address: address,
            key: GOOGLE_MAPS_API_KEY,
        });

        // Restrict to India for better results
        params.set('components', 'country:in');

        const response = await fetch(`${GOOGLE_GEOCODE_API_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Google Geocoding API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || !data.results.length) {
            console.warn('Google Geocoding API returned:', data.status);
            return null;
        }

        const result = data.results[0];
        const components = result.address_components || [];

        // Extract address components
        const getComponent = (types) => {
            return components.find(comp =>
                comp.types && comp.types.some(type => types.includes(type))
            )?.long_name || '';
        };

        return {
            formattedAddress: result.formatted_address,
            latitude: result.geometry?.location?.lat || null,
            longitude: result.geometry?.location?.lng || null,
            houseNumber: getComponent(['street_number']),
            houseName: getComponent(['premise']),
            street: getComponent(['route']),
            city: getComponent(['locality', 'administrative_area_level_2']),
            district: getComponent(['administrative_area_level_3']),
            state: getComponent(['administrative_area_level_1']),
            pincode: getComponent(['postal_code']),
            country: getComponent(['country']) || 'India',
        };
    } catch (error) {
        console.error('Error geocoding with Google:', error);
        return null;
    }
}

export async function reverseGeocode(latitude, longitude) {
    if (!latitude || !longitude) {
        return null;
    }

    // Try Google Maps Reverse Geocoding first if API key is available
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        try {
            const googleResult = await reverseGeocodeWithGoogle(latitude, longitude);
            if (googleResult) {
                return googleResult;
            }
        } catch (error) {
            console.warn('Google Maps reverse geocoding failed, falling back to backend:', error);
        }
    }

    // Fallback to backend proxy (MapMyIndia/Nominatim)
    try {
        const url = `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn('MapMyIndia Reverse Geocoding API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.responseCode !== 200 || !data.results || !data.results.length) {
            return null;
        }

        const result = data.results[0];
        return {
            formattedAddress: result.formattedAddress || '',
            houseNumber: result.houseNumber || '',
            houseName: result.HOUSE_NAME || '',
            street: result.street || '',
            city: result.city || result.area || '',
            district: result.district || '',
            state: result.state || '',
            pincode: result.pincode || '',
            country: result.country || 'India',
            latitude: latitude,
            longitude: longitude,
        };
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return null;
    }
}

// Google Maps Reverse Geocoding
async function reverseGeocodeWithGoogle(latitude, longitude) {
    try {
        const params = new URLSearchParams({
            latlng: `${latitude},${longitude}`,
            key: GOOGLE_MAPS_API_KEY,
        });

        const response = await fetch(`${GOOGLE_GEOCODE_API_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Google Reverse Geocoding API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || !data.results.length) {
            console.warn('Google Reverse Geocoding API returned:', data.status);
            return null;
        }

        const result = data.results[0];
        const components = result.address_components || [];

        // Extract address components
        const getComponent = (types) => {
            return components.find(comp =>
                comp.types && comp.types.some(type => types.includes(type))
            )?.long_name || '';
        };

        return {
            formattedAddress: result.formatted_address,
            houseNumber: getComponent(['street_number']),
            houseName: getComponent(['premise']),
            street: getComponent(['route']),
            city: getComponent(['locality', 'administrative_area_level_2']),
            district: getComponent(['administrative_area_level_3']),
            state: getComponent(['administrative_area_level_1']),
            pincode: getComponent(['postal_code']),
            country: getComponent(['country']) || 'India',
            latitude: latitude,
            longitude: longitude,
        };
    } catch (error) {
        console.error('Error reverse geocoding with Google:', error);
        return null;
    }
}

export async function searchPlaces(query, location = null) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    // Try Google Maps API first if API key is available
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        try {
            const googleResults = await searchGooglePlaces(query, location);
            if (googleResults.length > 0) {
                return googleResults;
            }
        } catch (error) {
            console.warn('Google Maps search failed, falling back to backend:', error);
        }
    }

    // Fallback to backend proxy (MapMyIndia/Nominatim)
    try {
        const params = new URLSearchParams({
            query: query.trim(),
        });

        if (location?.latitude && location?.longitude) {
            params.set('near_lat', location.latitude.toString());
            params.set('near_lng', location.longitude.toString());
        }

        const response = await fetch(`${SEARCH_URL}?${params.toString()}`);

        if (!response.ok) {
            console.warn('Search API error:', response.status);
            return [];
        }

        const data = await response.json();

        if (data.responseCode !== 200 || !data.results) {
            return [];
        }

        return data.results.map((result, idx) => ({
            placeId: result.placeId || result.place_id || `place-${idx}-${Date.now()}`,
            name: result.name || result.formattedAddress?.split(',')[0] || query.trim(),
            formattedAddress: result.formattedAddress || result.name || query.trim(),
            latitude: result.latitude !== null && result.latitude !== undefined ? parseFloat(result.latitude) : null,
            longitude: result.longitude !== null && result.longitude !== undefined ? parseFloat(result.longitude) : null,
            distanceKm: result.distanceKm != null ? result.distanceKm : null,
            city: result.city || '',
            state: result.state || '',
            pincode: result.pincode || '',
            type: result.type || '',
        }));
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
}

// Google Maps Places Autocomplete Search
async function searchGooglePlaces(query, location = null) {
    try {
        const params = new URLSearchParams({
            input: query.trim(),
            key: GOOGLE_MAPS_API_KEY,
            fields: 'place_id,name,formatted_address,geometry,types',
        });

        // Add location bias for better results
        if (location?.latitude && location?.longitude) {
            const radius = 15000; // 15km radius
            params.set('location', `${location.latitude},${location.longitude}`);
            params.set('radius', radius.toString());
        }

        // Restrict to India for better local results
        params.set('components', 'country:in');

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`Google Places API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.predictions) {
            console.warn('Google Places API returned:', data.status);
            return [];
        }

        // Get detailed place information for each prediction
        const results = await Promise.all(
            data.predictions.slice(0, 10).map(async (prediction) => {
                try {
                    const placeDetails = await getGooglePlaceDetails(prediction.place_id);
                    return {
                        placeId: prediction.place_id,
                        name: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
                        formattedAddress: prediction.description,
                        latitude: placeDetails?.latitude || null,
                        longitude: placeDetails?.longitude || null,
                        city: placeDetails?.city || '',
                        state: placeDetails?.state || '',
                        pincode: placeDetails?.pincode || '',
                        type: prediction.types?.[0] || '',
                    };
                } catch (error) {
                    // If details fail, return prediction with geometry from prediction
                    return {
                        placeId: prediction.place_id,
                        name: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
                        formattedAddress: prediction.description,
                        latitude: null,
                        longitude: null,
                        city: '',
                        state: '',
                        pincode: '',
                        type: prediction.types?.[0] || '',
                    };
                }
            })
        );

        return results.filter(result => result.latitude && result.longitude);
    } catch (error) {
        console.error('Error searching Google Places:', error);
        return [];
    }
}

// Get detailed place information from Google Places API
async function getGooglePlaceDetails(placeId) {
    try {
        const params = new URLSearchParams({
            place_id: placeId,
            key: GOOGLE_MAPS_API_KEY,
            fields: 'geometry,formatted_address,address_components',
        });

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`Google Place Details API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.result) {
            return null;
        }

        const result = data.result;
        const components = result.address_components || [];

        // Extract address components
        const getComponent = (types) => {
            return components.find(comp =>
                comp.types && comp.types.some(type => types.includes(type))
            )?.long_name || '';
        };

        return {
            latitude: result.geometry?.location?.lat || null,
            longitude: result.geometry?.location?.lng || null,
            formattedAddress: result.formatted_address || '',
            city: getComponent(['locality', 'administrative_area_level_2']),
            state: getComponent(['administrative_area_level_1']),
            pincode: getComponent(['postal_code']),
        };
    } catch (error) {
        console.error('Error getting place details:', error);
        return null;
    }
}

export function formatAddress(addressComponents) {
    if (!addressComponents) return '';

    const parts = [];

    if (addressComponents.houseNumber || addressComponents.houseName) {
        parts.push([addressComponents.houseNumber, addressComponents.houseName].filter(Boolean).join(' '));
    }

    if (addressComponents.street) {
        parts.push(addressComponents.street);
    }

    if (addressComponents.area || addressComponents.city) {
        parts.push(addressComponents.area || addressComponents.city);
    }

    if (addressComponents.pincode) {
        parts.push(addressComponents.pincode);
    }

    return parts.join(', ');
}

export default {
    geocodeAddress,
    reverseGeocode,
    searchPlaces,
    formatAddress,
};
