import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'rider_token';
const USER_KEY = 'rider_user';
const ACTIVE_ORDER_KEY = 'rider_active_order';

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async getUser<T>(): Promise<T | null> {
    try {
      const userStr = await AsyncStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async clearUser(): Promise<void> {
    await AsyncStorage.removeItem(USER_KEY);
  },

  async getActiveOrder<T>(): Promise<T | null> {
    try {
      const orderStr = await AsyncStorage.getItem(ACTIVE_ORDER_KEY);
      return orderStr ? JSON.parse(orderStr) : null;
    } catch {
      return null;
    }
  },

  async setActiveOrder<T>(order: T): Promise<void> {
    await AsyncStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(order));
  },

  async clearActiveOrder(): Promise<void> {
    await AsyncStorage.removeItem(ACTIVE_ORDER_KEY);
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ACTIVE_ORDER_KEY]);
  },
};
