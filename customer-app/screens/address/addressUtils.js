/**
 * Helpers for the saved-address shape (users/schemas/user.schema.ts Address:
 * type, address, city, pincode, isDefault, latitude, longitude). Addresses picked
 * on the map may also carry `coords: { latitude, longitude }`.
 */

const norm = (v) => String(v || '').toLowerCase().trim();

export const isSameAddress = (a, b) => !!a && !!b && (
    (a.id && b.id && a.id === b.id)
    || (norm(a.address) === norm(b.address) && norm(a.city) === norm(b.city))
);

/** Maps GET /users/me addresses to the client shape used in the location slice. */
export const toClientAddresses = (addresses = []) => addresses.map((addr, index) => ({
    id: addr._id || `saved-${index}`,
    originalIndex: index,
    type: addr.type || 'Home',
    address: addr.address,
    city: addr.city,
    pincode: addr.pincode,
    isDefault: !!addr.isDefault,
    latitude: addr.latitude,
    longitude: addr.longitude,
}));

const validCoord = (v) => typeof v === 'number' && Number.isFinite(v);

/** { latitude, longitude } for an address, falling back to a matching saved address. */
export const resolveCoords = (addr, saved = []) => {
    if (!addr) return null;
    const lat = addr.latitude ?? addr.coords?.latitude;
    const lng = addr.longitude ?? addr.coords?.longitude;
    if (validCoord(lat) && validCoord(lng)) return { latitude: lat, longitude: lng };
    const match = saved.find((s) => isSameAddress(s, addr));
    if (match && validCoord(match.latitude) && validCoord(match.longitude)) {
        return { latitude: match.latitude, longitude: match.longitude };
    }
    return null;
};

/** "H.No. 214, Shivpuri Colony, Gorakhpur - 273016" (skips missing parts). */
export const formatAddressLine = (addr, { pincode = true } = {}) => {
    if (!addr) return '';
    const street = addr.address || addr.addressLine || '';
    const city = addr.city && !norm(street).includes(norm(addr.city)) ? addr.city : '';
    const line = [street, city].filter(Boolean).join(', ');
    return pincode && addr.pincode && !line.includes(String(addr.pincode)) ? `${line} - ${addr.pincode}` : line;
};

export const addressIcon = (type) => {
    const t = norm(type);
    if (t === 'home') return 'home-variant-outline';
    if (t === 'work' || t === 'office') return 'briefcase-outline';
    if (t.includes('current')) return 'crosshairs-gps';
    return 'map-marker-outline';
};

/** Tile tint key per address type. */
export const addressTint = (type) => {
    const t = norm(type);
    if (t === 'home') return 'violet';
    if (t === 'work' || t === 'office') return 'sky';
    return 'mint';
};

export const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
};
