import axios from 'axios';
import { API_CONFIG } from './config';

// Create axios instance with credentials for cookie support
const api = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies with requests
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Cookie-based refresh - cookies are sent automatically
                await axios.post(
                    `${API_CONFIG.baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                // Session expired - user needs to login again
                console.log('Session expired, please login again');
            }
        }

        return Promise.reject(error);
    }
);

export default api;
