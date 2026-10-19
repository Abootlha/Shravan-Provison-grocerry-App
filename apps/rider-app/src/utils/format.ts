import { Alert, Linking, Platform } from 'react-native';
import type { Coordinates } from '../types/order';

export const formatMoney = (amount: number | null | undefined, options: { decimals?: boolean } = {}): string => {
  const value = Number(amount) || 0;
  const decimals = options.decimals ?? !Number.isInteger(value);
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
};

const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  const h12 = hours % 12 || 12;
  return `${h12}:${pad(date.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today, 9:45 PM", "Yesterday, 8:10 AM" or "12 Oct, 7:02 PM". */
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const time = formatTime(iso);
  if (date.getTime() >= startOfToday) return `Today, ${time}`;
  if (date.getTime() >= startOfToday - dayMs) return `Yesterday, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
};

/** "just now", "4 min ago", "2 h ago". */
export const formatAgo = (iso?: string | null, now = Date.now()): string => {
  if (!iso) return '';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(iso);
};

export const formatDistance = (km: number | null | undefined): string => {
  if (km == null || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export const distanceKm = (a: Coordinates | null | undefined, b: Coordinates | null | undefined): number | null => {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const formatPhone = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10) return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  return phone;
};

/** Opens the dialer. Shows an alert instead of failing silently. */
export const callPhone = async (phone?: string | null, label = 'this number'): Promise<void> => {
  const cleaned = (phone || '').replace(/[^\d+]/g, '');
  if (!cleaned) {
    Alert.alert('No phone number', `There is no phone number for ${label}.`);
    return;
  }
  const url = `tel:${cleaned}`;
  try {
    // No canOpenURL check: Android 11+ answers false for tel: without a
    // manifest <queries> entry even though the dialer opens fine.
    await Linking.openURL(url);
  } catch {
    Alert.alert('Cannot place call', `Dial ${formatPhone(phone)} manually.`);
  }
};

/** Turn-by-turn in Google Maps (app if installed, else the browser). */
export const openNavigation = async (destination: Coordinates, origin?: Coordinates | null): Promise<void> => {
  const dest = `${destination.latitude},${destination.longitude}`;
  const candidates: string[] = [];
  if (Platform.OS === 'android') {
    candidates.push(`google.navigation:q=${dest}&mode=l`);
  } else if (Platform.OS === 'ios') {
    candidates.push(`comgooglemaps://?daddr=${dest}&directionsmode=driving`);
    candidates.push(`maps://?daddr=${dest}&dirflg=d`);
  }
  if (Platform.OS === 'android') {
    // google.navigation: is handled by Google Maps; canOpenURL is unreliable
    // on Android 11+ (package visibility), so just try it.
    try {
      await Linking.openURL(candidates[0]);
      return;
    } catch {
      // Fall through to the web URL.
    }
  } else {
    for (const url of candidates) {
      try {
        if (await Linking.canOpenURL(url)) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // Try the next option.
      }
    }
  }
  const originPart = origin ? `&origin=${origin.latitude},${origin.longitude}` : '';
  await Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}${originPart}&travelmode=two-wheeler`
  );
};
