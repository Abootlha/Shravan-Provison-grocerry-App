import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AUTH_SERVICE_URL, ORDER_SERVICE_URL, RIDER_SERVICE_URL } from '../utils/constants';
import { storage } from './storage';
import { refreshAccessToken } from './authSession';
import type { Rider, RiderMetrics, RiderStatus } from '../types/rider';
import type { Address, Coordinates, Order, OrderStatus, PaymentMethod, TimelineEntry } from '../types/order';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await storage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
        const url = original?.url || '';
        const isAuthRoute = /\/auth\/(refresh|rider\/login|verify-otp|send-otp|logout)/.test(url);

        if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
          original._retry = true;
          const token = await refreshAccessToken();
          if (token) {
            original.headers.Authorization = `Bearer ${token}`;
            return this.client(original);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, config?: { data?: unknown }): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

const authClient = new ApiClient(AUTH_SERVICE_URL);
const riderClient = new ApiClient(RIDER_SERVICE_URL);
const orderClient = new ApiClient(ORDER_SERVICE_URL);

/** Human-readable message from an API error (Nest sends string or string[]). */
export const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'No internet connection. Check your network and try again.';
    }
    const message = (error.response.data as { message?: unknown } | undefined)?.message;
    if (Array.isArray(message) && message.length) return String(message[0]);
    if (typeof message === 'string' && message.trim()) return message;
    if (error.response.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (error.response.status >= 500) return 'Server error. Please try again in a moment.';
  }
  return fallback;
};

export const apiErrorStatus = (error: unknown): number | null =>
  axios.isAxiosError(error) ? (error.response?.status ?? null) : null;

const STATUS_MAP: Record<string, OrderStatus> = {
  CONFIRMED: 'confirmed',
  ASSIGNED: 'assigned',
  PACKED: 'packed',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const normalizeStatus = (status?: string): OrderStatus =>
  STATUS_MAP[(status || '').toUpperCase()] || 'confirmed';

export const toServerStatus = (status: OrderStatus): string => status.toUpperCase();

// Store details from GET /settings/store, used when an order payload has no
// pickup data (e.g. raw orders from /orders/available).
let storeFallback: { name?: string; phone?: string; address?: string; location: Coordinates | null } | null = null;

const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Accepts {latitude, longitude}, {lat, lng} or GeoJSON {coordinates:[lng,lat]}. */
export const toCoordinates = (value: any): Coordinates | null => {
  if (!value) return null;
  if (isNum(value.latitude) && isNum(value.longitude)) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  if (isNum(value.lat) && isNum(value.lng)) {
    return { latitude: value.lat, longitude: value.lng };
  }
  const pair = Array.isArray(value.coordinates) ? value.coordinates : Array.isArray(value) ? value : null;
  if (pair && isNum(pair[0]) && isNum(pair[1])) {
    return { latitude: pair[1], longitude: pair[0] };
  }
  if (value.coordinates && !Array.isArray(value.coordinates)) {
    return toCoordinates(value.coordinates);
  }
  return null;
};

const normalizeVehicle = (value?: string): string | undefined => {
  if (!value) return undefined;
  const legacy: Record<string, string> = {
    bike: 'Two Wheeler',
    scooter: 'Two Wheeler',
    motorcycle: 'Two Wheeler',
    bicycle: 'Bicycle',
    cycle: 'Bicycle',
    car: 'Four Wheeler',
  };
  return legacy[value.toLowerCase()] || value;
};

export const normalizeRider = (record: any): Rider => {
  const status: RiderStatus =
    record.status === 'available' || record.status === 'busy' || record.status === 'offline'
      ? record.status
      : record.isOnline
        ? 'available'
        : 'offline';
  return {
    id: String(record._id || record.id || record.userId || ''),
    name: record.name || 'Rider',
    username: record.username,
    phone: record.phone || '',
    vehicleType: normalizeVehicle(record.vehicleType),
    vehicleNumber: record.vehicleNumber || undefined,
    status,
    isOnline: status !== 'offline',
    isActive: record.isActive,
    rating: isNum(record.rating) ? record.rating : 0,
    totalDeliveries: isNum(record.totalDeliveries) ? record.totalDeliveries : 0,
    createdAt: record.createdAt,
  };
};

// Last entry wins: an order re-offered after a rejection has a newer ASSIGNED.
const timelineTime = (timeline: TimelineEntry[], status: OrderStatus): string | undefined =>
  [...timeline].reverse().find((entry) => entry.status === status)?.timestamp;

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const isoOrUndefined = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const time = new Date(value as string).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
};

export const normalizeOrder = (order: any): Order => {
  const rawTimeline: any[] = Array.isArray(order.timeline) ? order.timeline : [];
  const timeline: TimelineEntry[] = rawTimeline
    .filter((entry) => entry && entry.status && isoOrUndefined(entry.timestamp))
    .map((entry) => ({
      status: normalizeStatus(entry.status),
      timestamp: isoOrUndefined(entry.timestamp) as string,
      note: str(entry.note),
    }));

  const deliveryAddress = order.deliveryAddress || {};
  const customer = typeof order.userId === 'object' && order.userId ? order.userId : {};

  const pickupCoords =
    toCoordinates(order.pickup?.address?.coordinates) ||
    toCoordinates(order.storeLocation) ||
    storeFallback?.location ||
    null;

  const deliveryCoords =
    toCoordinates(order.delivery?.address?.coordinates) || toCoordinates(deliveryAddress.coordinates);

  const delivery: Address = {
    full:
      str(order.delivery?.address?.full) ||
      [deliveryAddress.address, deliveryAddress.city, deliveryAddress.pincode].filter(Boolean).join(', '),
    coordinates: deliveryCoords,
    type: str(deliveryAddress.type),
    houseNo: str(deliveryAddress.houseNo ?? order.delivery?.address?.houseNo),
    floor: str(deliveryAddress.floor ?? order.delivery?.address?.floor),
    landmark: str(deliveryAddress.landmark ?? order.delivery?.address?.landmark),
    city: str(deliveryAddress.city),
    pincode: str(deliveryAddress.pincode),
  };

  const tracking = order.tracking || {};
  const route: Coordinates[] = Array.isArray(tracking.routeCoordinates)
    ? (tracking.routeCoordinates.map(toCoordinates).filter(Boolean) as Coordinates[])
    : [];

  const paymentMethod = str(order.paymentMethod)?.toUpperCase() as PaymentMethod | undefined;

  return {
    id: String(order._id || order.id || order.orderId),
    orderNumber: order.orderNumber || order.orderId || String(order._id || order.id || ''),
    status: normalizeStatus(order.orderStatus || order.status),
    pickup: {
      name: order.pickup?.name || order.storeName || storeFallback?.name || 'Store',
      phone: order.pickup?.phone || order.storePhone || storeFallback?.phone || '',
      address: {
        full: order.pickup?.address?.full || order.storeAddress || storeFallback?.address || '',
        coordinates: pickupCoords,
      },
    },
    delivery: {
      name: order.delivery?.name || order.customerName || customer.name || 'Customer',
      phone: order.delivery?.phone || order.customerPhone || customer.phone || '',
      receiverName: str(deliveryAddress.receiverName ?? order.delivery?.receiverName),
      receiverPhone: str(deliveryAddress.receiverPhone ?? order.delivery?.receiverPhone),
      instructions: str(order.deliveryInstructions),
      address: delivery,
    },
    items: (order.items || []).map((item: any, index: number) => ({
      id: String(item.productId?._id || item.productId || item.id || index),
      name: item.name || 'Item',
      quantity: Number(item.quantity) || 0,
      price: Number(item.price) || 0,
      image: item.image,
    })),
    itemTotal: isNum(order.itemTotal) ? order.itemTotal : undefined,
    totalAmount: Number(order.totalAmount) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    packagingFee: isNum(order.packagingFee) ? order.packagingFee : undefined,
    discount: isNum(order.discount) ? order.discount : undefined,
    tip: Number(order.tip) || 0,
    paymentMethod,
    paymentStatus: str(order.paymentStatus),
    timeline,
    createdAt: isoOrUndefined(order.createdAt),
    acceptedAt: timelineTime(timeline, 'assigned'),
    packedAt: timelineTime(timeline, 'packed'),
    pickedUpAt: timelineTime(timeline, 'picked_up'),
    outForDeliveryAt: timelineTime(timeline, 'out_for_delivery'),
    deliveredAt: timelineTime(timeline, 'delivered') || isoOrUndefined(order.actualDeliveryTime),
    cancelledAt: timelineTime(timeline, 'cancelled'),
    cancellationReason: str(order.cancellationReason),
    estimatedDeliveryTime: isoOrUndefined(tracking.estimatedDeliveryTime || order.estimatedDeliveryTime),
    routeCoordinates: route,
    activeLeg: tracking.activeLeg ?? null,
    distanceRemainingMeters: isNum(tracking.distanceRemaining) ? tracking.distanceRemaining : undefined,
    durationMinutes: isNum(tracking.durationMinutes) ? tracking.durationMinutes : undefined,
  };
};

/** Merge a fresh payload into a known order without losing fields the new one lacks. */
export const mergeOrder = (previous: Order | null | undefined, next: Order): Order => {
  if (!previous || previous.id !== next.id) return next;
  return {
    ...previous,
    ...next,
    pickup: next.pickup.address.coordinates ? next.pickup : { ...next.pickup, address: previous.pickup.address },
    delivery: next.delivery.address.coordinates
      ? next.delivery
      : { ...next.delivery, address: previous.delivery.address },
    items: next.items.length ? next.items : previous.items,
    timeline: next.timeline.length ? next.timeline : previous.timeline,
    paymentMethod: next.paymentMethod || previous.paymentMethod,
    createdAt: next.createdAt || previous.createdAt,
    routeCoordinates: next.routeCoordinates.length ? next.routeCoordinates : previous.routeCoordinates,
  };
};

const normalizeMetrics = (raw: any): RiderMetrics => {
  const period = (value: any) => ({
    deliveries: Number(value?.deliveries) || 0,
    earnings: Number(value?.earnings) || 0,
  });
  return {
    totalDeliveries: Number(raw?.totalDeliveries) || 0,
    avgRating: Number(raw?.avgRating) || 0,
    acceptanceRate: isNum(raw?.acceptanceRate) ? raw.acceptanceRate : 100,
    currency: raw?.currency || 'INR',
    timezone: raw?.timezone,
    earningsBasis: raw?.earningsBasis,
    today: period(raw?.today),
    week: period(raw?.week),
    month: period(raw?.month),
  };
};

const tokensFrom = (response: any) => ({
  token: response.accessToken || response.tokens?.accessToken,
  refreshToken: response.refreshToken || response.tokens?.refreshToken,
});

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await authClient.post<any>('/auth/rider/login', { username, password });
    return { ...tokensFrom(response), user: normalizeRider(response.user || {}) };
  },

  logout: async () => authClient.post<any>('/auth/logout'),

  sendOtp: async (phone: string) =>
    authClient.post<{ otpLength?: number; message?: string }>('/auth/send-otp', { phone }),

  verifyOtp: async (phone: string, otp: string) => {
    const response = await authClient.post<any>('/auth/verify-otp', { phone, otp, role: 'rider' });
    return { ...tokensFrom(response), user: normalizeRider(response.user || { phone }) };
  },
};

export const riderApi = {
  getMe: async () => {
    const response = await riderClient.get<any>('/riders/me');
    return normalizeRider(response.rider || response);
  },

  updateProfile: async (patch: { name?: string; vehicleType?: string; vehicleNumber?: string }) => {
    const response = await riderClient.put<any>('/riders/me', patch);
    return normalizeRider(response.rider || response);
  },

  updateAvailability: async (isOnline: boolean) => {
    // isAvailable is sent explicitly: online means ready for new requests.
    const response = await riderClient.put<any>('/riders/me/availability', {
      isOnline,
      isAvailable: isOnline,
    });
    return normalizeRider(response.rider || response);
  },

  /** Registers this phone for order alerts while the app is closed. */
  registerPushToken: async (token: string) => {
    await riderClient.put<any>('/riders/me/push-token', { token });
  },

  removePushToken: async (token: string) => {
    await riderClient.delete<any>('/riders/me/push-token', { data: { token } });
  },

  getMetrics: async () => normalizeMetrics(await riderClient.get<any>('/riders/me/metrics')),
};

export const settingsApi = {
  /** Public store settings; caches the store details for normalizeOrder. */
  loadStore: async () => {
    const settings = await orderClient.get<any>('/settings/store');
    storeFallback = {
      name: settings?.storeName,
      phone: settings?.contactPhone || undefined,
      address: settings?.address || settings?.location?.address || undefined,
      location: toCoordinates(settings?.location),
    };
    return storeFallback;
  },
};

export type StatusLocation = { latitude: number; longitude: number; accuracy?: number | null };

export const orderApi = {
  getAvailable: async () => {
    const response = await orderClient.get<any>('/orders/available');
    return (response.orders || []).map(normalizeOrder) as Order[];
  },

  getCurrent: async () => {
    const response = await orderClient.get<any>('/orders/current');
    return response.order ? normalizeOrder(response.order) : null;
  },

  getById: async (orderId: string) => {
    const response = await orderClient.get<any>(`/orders/${orderId}`);
    return normalizeOrder(response.order || response);
  },

  accept: async (orderId: string) => {
    const response = await orderClient.patch<any>(`/orders/${orderId}/accept`);
    return normalizeOrder(response.order || response);
  },

  reject: async (orderId: string, reason?: string) => {
    const body = reason ? { reason: reason.slice(0, 300) } : {};
    const response = await orderClient.patch<any>(`/orders/${orderId}/reject`, body);
    return { reassigned: Boolean(response?.reassigned) };
  },

  updateStatus: async (
    orderId: string,
    status: OrderStatus,
    options: { location?: StatusLocation | null; deliveryOtp?: string } = {}
  ) => {
    const body: Record<string, unknown> = { status: toServerStatus(status) };
    if (options.deliveryOtp) {
      // The customer reads this OTP to the rider; the server verifies it.
      body.deliveryOtp = options.deliveryOtp;
    }
    const loc = options.location;
    if (loc && isNum(loc.latitude) && isNum(loc.longitude)) {
      body.location = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        ...(isNum(loc.accuracy) && loc.accuracy >= 0 ? { accuracy: loc.accuracy } : {}),
      };
    }
    const response = await orderClient.patch<any>(`/orders/${orderId}/status`, body);
    return normalizeOrder(response.order || response);
  },
};
