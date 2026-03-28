import { Platform } from 'react-native';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Replace with your key

/**
 * Decode Google Maps encoded polyline string into coordinate array
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<{latitude: number, longitude: number}>}
 */
function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        });
    }

    return points;
}

// Simple in-memory cache for route data
const routeCache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCacheKey(origin, destination) {
    const oLat = origin.latitude.toFixed(4);
    const oLng = origin.longitude.toFixed(4);
    const dLat = destination.latitude.toFixed(4);
    const dLng = destination.longitude.toFixed(4);
    return `${oLat},${oLng}->${dLat},${dLng}`;
}

/**
 * Fetch route from Google Directions API
 * @param {object} origin - {latitude, longitude}
 * @param {object} destination - {latitude, longitude}
 * @returns {Promise<{coordinates: Array, distance: string, duration: string, durationValue: number}>}
 */
export async function fetchRoute(origin, destination) {
    if (!origin || !destination) {
        return null;
    }

    const cacheKey = getCacheKey(origin, destination);
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const originStr = `${origin.latitude},${origin.longitude}`;
        const destStr = `${destination.latitude},${destination.longitude}`;

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            console.warn('Directions API returned no routes:', data.status);
            return null;
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        // Decode the overview polyline
        const coordinates = decodePolyline(route.overview_polyline.points);

        const result = {
            coordinates,
            distance: leg.distance.text,
            distanceValue: leg.distance.value, // meters
            duration: leg.duration.text,
            durationValue: leg.duration.value, // seconds
            bounds: {
                northeast: route.bounds.northeast,
                southwest: route.bounds.southwest,
            },
            steps: leg.steps.map(step => ({
                instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
                distance: step.distance.text,
                duration: step.duration.text,
                startLocation: {
                    latitude: step.start_location.lat,
                    longitude: step.start_location.lng,
                },
                endLocation: {
                    latitude: step.end_location.lat,
                    longitude: step.end_location.lng,
                },
            })),
        };

        // Cache the result
        routeCache.set(cacheKey, { data: result, timestamp: Date.now() });

        return result;
    } catch (error) {
        console.error('Error fetching directions:', error);
        return null;
    }
}

/**
 * Generate a straight-line fallback route when API is unavailable
 * Useful for dev/testing without Google Maps API key
 */
export function generateFallbackRoute(origin, destination, numPoints = 20) {
    if (!origin || !destination) return [];

    const coordinates = [];
    for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        coordinates.push({
            latitude: origin.latitude + (destination.latitude - origin.latitude) * fraction,
            longitude: origin.longitude + (destination.longitude - origin.longitude) * fraction,
        });
    }
    return coordinates;
}

/**
 * Calculate bearing between two points (for marker rotation)
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(start, end) {
    if (!start || !end) return 0;

    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const dLng = endLng - startLng;

    const x = Math.sin(dLng) * Math.cos(endLat);
    const y =
        Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    let bearing = (Math.atan2(x, y) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
export function calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 0;

    const R = 6371000; // Earth's radius in meters
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export { decodePolyline, GOOGLE_MAPS_API_KEY };
