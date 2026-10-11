import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'rider_token';
const REFRESH_TOKEN_KEY = 'rider_refresh_token';
const USER_KEY = 'rider_user';
const ACTIVE_ORDER_KEY = 'rider_active_order';

// Tokens go to the OS keychain/keystore on native. expo-secure-store has no web
// implementation, so web falls back to AsyncStorage (localStorage).
const useSecureStore = Platform.OS !== 'web';

const secureGet = async (key: string): Promise<string | null> => {
  if (!useSecureStore) {
    return AsyncStorage.getItem(key);
  }
  const value = await SecureStore.getItemAsync(key);
  if (value) {
    return value;
  }
  // One-time migration of tokens saved to AsyncStorage by older builds.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy) {
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
  }
  return legacy;
};

const secureSet = async (key: string, value: string): Promise<void> => {
  if (!useSecureStore) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const secureRemove = async (key: string): Promise<void> => {
  if (useSecureStore) {
    await SecureStore.deleteItemAsync(key);
  }
  await AsyncStorage.removeItem(key);
};

export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await secureGet(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await secureSet(TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    await secureRemove(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await secureGet(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string | null | undefined): Promise<void> {
    if (token) {
      await secureSet(REFRESH_TOKEN_KEY, token);
    } else {
      await secureRemove(REFRESH_TOKEN_KEY);
    }
  },

  async clearTokens(): Promise<void> {
    await Promise.all([secureRemove(TOKEN_KEY), secureRemove(REFRESH_TOKEN_KEY)]);
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
    await this.clearTokens();
    await AsyncStorage.multiRemove([USER_KEY, ACTIVE_ORDER_KEY]);
  },
};
