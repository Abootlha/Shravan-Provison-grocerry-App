import { MAPMYINDIA_CONFIG } from './config';
import { API_BASE_URL } from './config';

const MAPMYINDIA_API_KEY = MAPMYINDIA_CONFIG.apiKey;
const MAPS_PROXY_URL = `${API_BASE_URL}/maps`;
const GEOCODE_URL = `${MAPS_PROXY_URL}/geocode`;
const REVERSE_GEOCODE_URL = `${MAPS_PROXY_URL}/reverse-geocode`;
const SEARCH_URL = `${MAPS_PROXY_URL}/search`;

export async function geocodeAddress(address) {
    if (!address) {
        return null;
    }

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

export async function reverseGeocode(latitude, longitude) {
    if (!latitude || !longitude) {
        return null;
    }

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

export async function searchPlaces(query, location = null) {
    if (!query || query.length < 3) {
        return [];
    }

    try {
        const params = new URLSearchParams({
            query: query,
        });

        if (location?.latitude && location?.longitude) {
            params.set('near_lat', location.latitude.toString());
            params.set('near_lng', location.longitude.toString());
        }

        const response = await fetch(`${SEARCH_URL}?${params.toString()}`);

        if (!response.ok) {
            console.warn('MapMyIndia Search API error:', response.status);
            return [];
        }

        const data = await response.json();

        if (data.responseCode !== 200 || !data.results) {
            return [];
        }

        return data.results.map(result => ({
            placeId: result.place_id,
            formattedAddress: result.formattedAddress || result.eLoc,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lng),
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
