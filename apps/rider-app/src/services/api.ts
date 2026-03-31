import axios, { AxiosInstance, AxiosError } from 'axios';
import { AUTH_SERVICE_URL, ORDER_SERVICE_URL, RIDER_SERVICE_URL } from '../utils/constants';
import { storage } from './storage';
import type { Rider } from '../types/rider';

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
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          storage.clearToken();
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

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

const authClient = new ApiClient(AUTH_SERVICE_URL);
const riderClient = new ApiClient(RIDER_SERVICE_URL);
const orderClient = new ApiClient(ORDER_SERVICE_URL);

const normalizeStatus = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'ASSIGNED':
      return 'assigned';
    case 'OUT_FOR_DELIVERY':
      return 'in_transit';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    case 'ACCEPTED':
      return 'accepted';
    case 'PICKED_UP':
      return 'picked_up';
    case 'IN_TRANSIT':
      return 'in_transit';
    case 'PENDING':
    case 'CONFIRMED':
    case 'PACKED':
    default:
      return 'pending';
  }
};

const normalizeRider = (record: any): Rider => ({
  id: record._id || record.id || record.userId,
  name: record.name || record.user?.name || 'Rider',
  phone: record.phone || record.user?.phone || '',
  email: record.email || record.user?.email,
  vehicle: {
    type: record.vehicleType === 'bicycle' ? 'cycle' : record.vehicleType === 'car' ? 'scooter' : 'bike',
    number: record.vehicleNumber,
  },
  documents: {},
  isOnline: Boolean(record.isOnline ?? (record.status && record.status !== 'offline')),
  rating: record.rating ?? record.stats?.avgRating ?? 0,
  totalDeliveries: record.totalDeliveries ?? record.stats?.totalDeliveries ?? 0,
  acceptanceRate: record.acceptanceRate ?? record.stats?.acceptanceRate ?? 0,
  createdAt: record.createdAt || new Date().toISOString(),
});

const normalizeOrder = (order: any) => {
  const timeline = order.timeline || [];
  const assignedEntry = timeline.find?.((entry: any) => (entry.status || '').toUpperCase() === 'ASSIGNED');
  const pickedUpEntry = timeline.find?.((entry: any) => (entry.status || '').toUpperCase() === 'OUT_FOR_DELIVERY');
  const deliveredEntry = timeline.find?.((entry: any) => (entry.status || '').toUpperCase() === 'DELIVERED');

  return {
    id: order._id || order.id || order.orderId,
    orderNumber: order.orderId || order.id || order._id,
    status: normalizeStatus(order.orderStatus || order.status),
    pickup: {
      name: order.storeName || 'Store',
      phone: order.storePhone || '',
      address: {
        full: order.storeAddress || '',
        coordinates: {
          latitude: order.storeLocation?.latitude || 26.7606,
          longitude: order.storeLocation?.longitude || 83.3732,
        },
      },
    },
    delivery: {
      name: order.customerName || 'Customer',
      phone: order.customerPhone || '',
      address: {
        full: order.deliveryAddress?.address || '',
        coordinates: {
          latitude: order.deliveryAddress?.coordinates?.coordinates?.[1] || 0,
          longitude: order.deliveryAddress?.coordinates?.coordinates?.[0] || 0,
        },
      },
    },
    items: (order.items || []).map((item: any) => ({
      id: item.productId || item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    totalAmount: order.totalAmount || 0,
    deliveryFee: order.deliveryFee || 0,
    deliveryOtp: order.deliveryOtp,
    createdAt: order.createdAt || new Date().toISOString(),
    estimatedTime: order.estimatedDeliveryTime ? Date.parse(order.estimatedDeliveryTime) : undefined,
    acceptedAt: assignedEntry?.timestamp,
    pickedUpAt: pickedUpEntry?.timestamp,
    deliveredAt: deliveredEntry?.timestamp,
  };
};

export const authApi = {
  login: async (username: string, password: string) => {
    const response = await authClient.post<any>('/auth/rider/login', {
      username,
      password,
    });
    const token = response.accessToken || response.tokens?.accessToken;
    const rider = normalizeRider(response.user || {});
    return { token, user: rider };
  },

  sendOtp: async (phone: string) => {
    return authClient.post<any>('/auth/send-otp', { phone });
  },

  verifyOtp: async (phone: string, otp: string, name?: string) => {
    const response = await authClient.post<any>('/auth/verify-otp', {
      phone,
      otp,
      name,
      role: 'rider',
    });
    const token = response.accessToken || response.tokens?.accessToken;
    const rider = normalizeRider(response.user || { name, phone });
    return { token, user: rider };
  },
};

export const riderApi = {
  getMe: async () => {
    const rider = await riderClient.get<any>('/riders/me');
    return normalizeRider(rider.rider || rider);
  },

  updateAvailability: async (isOnline: boolean) => {
    const user = await storage.getUser<Rider>();
    if (!user?.id) {
      throw new Error('Rider not found');
    }
    const rider = await riderClient.put<any>('/riders/me/availability', {
      isOnline,
      isAvailable: isOnline,
    });
    return normalizeRider(rider.rider || rider);
  },

  getEarnings: async (_period: 'daily' | 'weekly' | 'monthly') => {
    const user = await storage.getUser<Rider>();
    if (!user?.id) {
      throw new Error('Rider not found');
    }
    const stats = await riderClient.get<any>('/riders/me/metrics');
    return {
      today: 0,
      week: 0,
      month: 0,
      stats: {
        deliveries: stats.totalDeliveries || 0,
        rating: stats.avgRating || 0,
        acceptanceRate: stats.acceptanceRate || 0,
      },
    };
  },
};

export const orderApi = {
  getAvailable: async () => {
    const response = await orderClient.get<any>('/orders/available');
    return (response.orders || []).map(normalizeOrder);
  },

  accept: async (orderId: string) => {
    const response = await orderClient.patch<any>(`/orders/${orderId}/accept`);
    return { order: normalizeOrder(response.order || response) };
  },

  reject: async (_orderId: string) =>
    ({ success: true }),

  updateStatus: async (orderId: string, status: string, _location?: { latitude: number; longitude: number }) => {
    const statusMap: Record<string, string> = {
      accepted: 'ASSIGNED',
      picked_up: 'OUT_FOR_DELIVERY',
      in_transit: 'OUT_FOR_DELIVERY',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
      pending: 'PENDING',
      assigned: 'ASSIGNED',
    };

    const response = await orderClient.patch<any>(`/orders/${orderId}/status`, {
      status: statusMap[status] || status.toUpperCase(),
    });
    return { order: normalizeOrder(response.order || response) };
  },
};
