/**
 * Helpers for the saved-address shape (users/schemas/user.schema.ts Address:
 * _id, type, address, city, pincode, isDefault, latitude, longitude and the optional
 * houseNo, floor, landmark, receiverName, receiverPhone). Addresses picked on the map
 * may also carry `coords: { latitude, longitude }`.
 */

const norm = (v) => String(v || '').toLowerCase().trim();

export const isSameAddress = (a, b) => !!a && !!b && (
    (a.id && b.id && a.id === b.id)
    || (norm(a.address) === norm(b.address) && norm(a.city) === norm(b.city))
);

/** Optional details an address may carry (all strings, '' when unset). */
export const ADDRESS_DETAIL_FIELDS = ['houseNo', 'floor', 'landmark', 'receiverName', 'receiverPhone'];

export const ADDRESS_LABELS = [
    { id: 'Home', en: 'Home', hi: 'घर', icon: 'home-variant-outline' },
    { id: 'Work', en: 'Work', hi: 'काम', icon: 'briefcase-outline' },
    { id: 'Other', en: 'Other', hi: 'अन्य', icon: 'map-marker-outline' },
];

/** Older saved addresses use "Office" (shown as Work); unknown free text is Other. */
export const normaliseLabel = (t) => (
    t === 'Office' ? 'Work' : ADDRESS_LABELS.some((a) => a.id === t) ? t : t ? 'Other' : 'Home'
);

export const labelText = (type, isHi) => {
    const found = ADDRESS_LABELS.find((a) => a.id === normaliseLabel(type));
    return found ? (isHi ? found.hi : found.en) : type;
};

/**
 * Maps GET /users/me addresses to the client shape used in the location slice. `id` is the
 * server `_id` (stable); without one (older backend / mock) it falls back to `saved-<index>`.
 * `originalIndex` is kept for those index-only backends.
 */
export const toClientAddresses = (addresses = []) => addresses.map((addr, index) => ({
    id: addr._id ? String(addr._id) : `saved-${index}`,
    originalIndex: index,
    type: addr.type || 'Home',
    address: addr.address,
    city: addr.city,
    pincode: addr.pincode,
    isDefault: !!addr.isDefault,
    latitude: addr.latitude,
    longitude: addr.longitude,
    ...Object.fromEntries(ADDRESS_DETAIL_FIELDS.map((k) => [k, addr[k] || ''])),
}));

/**
 * After POST /users/addresses: the entry the server stored for `input` (it updates an
 * existing address with the same type + address + city instead of adding a duplicate).
 */
export const findSavedMatch = (clientAddresses, input) => {
    const same = clientAddresses.filter((a) => norm(a.address) === norm(input.address)
        && norm(a.city) === norm(input.city)
        && (!input.type || a.type === input.type));
    return same[same.length - 1] || null;
};

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

/** "Flat 4B, Floor 2" (house / flat and floor only). */
export const formatUnitLine = (addr, isHi = false) => {
    if (!addr) return '';
    const floor = String(addr.floor || '').trim();
    return [
        String(addr.houseNo || '').trim(),
        floor ? (isHi ? `मंज़िल ${floor}` : `Floor ${floor}`) : '',
    ].filter(Boolean).join(', ');
};

/** Unit line + street/city/pincode + landmark: everything a rider needs, on one string. */
export const formatFullAddress = (addr, isHi = false) => {
    if (!addr) return '';
    const landmark = String(addr.landmark || '').trim();
    const street = addr.address || addr.addressLine || '';
    const city = addr.city && !norm(street).includes(norm(addr.city)) ? addr.city : '';
    const pincode = addr.pincode && !street.includes(String(addr.pincode)) ? String(addr.pincode) : '';
    return [
        formatUnitLine(addr, isHi),
        street,
        landmark && !norm(street).includes(norm(landmark)) ? (isHi ? `${landmark} के पास` : `Near ${landmark}`) : '',
        [city, pincode].filter(Boolean).join(' - '),
    ].filter(Boolean).join(', ');
};

/**
 * The `address` string sent with an order (POST /orders deliveryAddress has no unit or
 * landmark fields): house / flat, floor, street, landmark. Always English, for the rider.
 */
export const orderAddressLine = (addr) => {
    if (!addr) return '';
    const street = addr.address || addr.addressLine || '';
    const landmark = String(addr.landmark || '').trim();
    const unit = formatUnitLine(addr, false);
    return [
        unit && !norm(street).startsWith(norm(unit)) ? unit : '',
        street,
        landmark && !norm(street).includes(norm(landmark)) ? `Near ${landmark}` : '',
    ].filter(Boolean).join(', ');
};

/** "+91 98765 43210" for display; '' when unset. */
export const formatPhone = (phone) => {
    const digits = String(phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : String(phone || '');
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
