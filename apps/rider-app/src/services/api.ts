import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from './storage';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
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

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiClient = new ApiClient();

export const authApi = {
  sendOtp: (phone: string) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, otp: string) =>
    apiClient.post<{ token: string; user: unknown }>('/auth/verify-otp', { phone, otp }),
};

export const riderApi = {
  getMe: () => apiClient.get('/riders/me'),

  updateAvailability: (isOnline: boolean) =>
    apiClient.patch<{ isOnline: boolean }>('/riders/availability', { isOnline }),

  getEarnings: (period: 'daily' | 'weekly' | 'monthly') =>
    apiClient.get<{
      today: number;
      week: number;
      month: number;
      stats: {
        deliveries: number;
        rating: number;
        acceptanceRate: number;
      };
    }>('/riders/earnings', { period }),
};

export const orderApi = {
  getAvailable: () => apiClient.get('/orders/available'),

  accept: (orderId: string) =>
    apiClient.post<{ order: unknown }>(`/orders/${orderId}/accept`),

  reject: (orderId: string) =>
    apiClient.post<{ success: boolean }>(`/orders/${orderId}/reject`),

  updateStatus: (orderId: string, status: string, location?: { latitude: number; longitude: number }) =>
    apiClient.patch<{ order: unknown }>(`/orders/${orderId}/status`, { status, location }),
};
