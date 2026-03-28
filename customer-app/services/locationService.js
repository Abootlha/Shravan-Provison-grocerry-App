import { MAPMYINDIA_CONFIG } from './config';

const MAPMYINDIA_API_KEY = MAPMYINDIA_CONFIG.apiKey;
const GEOCODE_URL = `${MAPMYINDIA_CONFIG.baseUrl}/geocode`;
const REVERSE_GEOCODE_URL = `${MAPMYINDIA_CONFIG.baseUrl}/rev_geocode`;

export async function geocodeAddress(address) {
    if (!address || !MAPMYINDIA_API_KEY) {
        return null;
    }

    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `${GEOCODE_URL}/${encodedAddress}?region=ind&bbox=79.0,20.0,90.0,30.0`;

        const response = await fetch(url, {
            headers: {
                'Authorization': MAPMYINDIA_API_KEY,
            },
        });

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
    if (!latitude || !longitude || !MAPMYINDIA_API_KEY) {
        return null;
    }

    try {
        const url = `${REVERSE_GEOCODE_URL}?lat=${latitude}&lng=${longitude}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': MAPMYINDIA_API_KEY,
            },
        });

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
    if (!query || query.length < 3 || !MAPMYINDIA_API_KEY) {
        return [];
    }

    try {
        let url = `${MAPMYINDIA_CONFIG.baseUrl}/search/6?query=${encodeURIComponent(query)}&region=ind&filter=pv:ind`;

        if (location) {
            url += `&near_lat=${location.latitude}&near_lng=${location.longitude}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': MAPMYINDIA_API_KEY,
            },
        });

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
