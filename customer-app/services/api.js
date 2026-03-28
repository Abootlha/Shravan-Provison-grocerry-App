import axios from 'axios';
import { API_CONFIG } from './config';

const api = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                await axios.post(
                    `${API_CONFIG.baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );
                return api(originalRequest);
            } catch (refreshError) {
                console.log('Session expired, please login again');
            }
        }

        return Promise.reject(error);
    }
);

export default api;
