import { Platform } from 'react-native';
import Constants from 'expo-constants';

const LOCAL_IP = Constants.expoConfig?.extra?.LOCAL_IP || '192.168.31.166';

const getBaseUrl = () => {
  if (!__DEV__) {
    return 'https://api.shravankirana.com/api/v1';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api/v1';
  }

  return `http://${LOCAL_IP}:3000/api/v1`;
};

const getSocketUrl = () => {
  if (!__DEV__) {
    return 'https://api.shravankirana.com/tracking';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3000/tracking';
  }

  return `http://${LOCAL_IP}:3000/tracking`;
};

export const AUTH_SERVICE_URL = getBaseUrl();

export const RIDER_SERVICE_URL = getBaseUrl();

export const ORDER_SERVICE_URL = getBaseUrl();

export const SOCKET_URL = getSocketUrl();

export const LOCATION_UPDATE_INTERVAL = 3000;
export const LOCATION_UPDATE_THROTTLE = 3000;

export const MAPMYINDIA_APP_ID = 'MAPMYINDIA_APP_ID';
export const MAPMYINDIA_APP_CODE = 'MAPMYINDIA_APP_CODE';
export const MAPMYINDIA_MAP_SDK_KEY = 'MAPMYINDIA_MAP_SDK_KEY';

export const COLORS = {
  primary: '#1E3A8A',
  primaryDark: '#1E40AF',
  secondary: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  background: '#F3F4F6',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  disabled: '#9CA3AF',
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_transit: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  assigned: COLORS.primary,
  in_transit: '#EC4899',
  delivered: COLORS.success,
  cancelled: COLORS.error,
};
