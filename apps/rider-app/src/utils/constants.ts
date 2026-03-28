export const AUTH_SERVICE_URL = __DEV__
  ? 'http://localhost:8001'
  : 'https://api.shravankirana.com';

export const RIDER_SERVICE_URL = __DEV__
  ? 'http://localhost:8003'
  : 'https://api.shravankirana.com';

export const ORDER_SERVICE_URL = __DEV__
  ? 'http://localhost:8004'
  : 'https://api.shravankirana.com';

export const SOCKET_URL = __DEV__
  ? 'http://localhost:8010'
  : 'https://api.shravankirana.com';

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
  accepted: 'Accepted',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  assigned: COLORS.primary,
  accepted: COLORS.primaryDark,
  picked_up: '#8B5CF6',
  in_transit: '#EC4899',
  delivered: COLORS.success,
  cancelled: COLORS.error,
};
