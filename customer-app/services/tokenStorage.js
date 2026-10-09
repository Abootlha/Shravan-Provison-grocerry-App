import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Auth tokens live in the OS keychain/keystore on native. expo-secure-store has
// no web implementation, so web falls back to AsyncStorage (localStorage).
const ACCESS_TOKEN_KEY = 'customerAccessToken';
const REFRESH_TOKEN_KEY = 'customerRefreshToken';
const USER_KEY = 'customerUser';

const useSecureStore = Platform.OS !== 'web';

const getItem = async (key) => {
    if (useSecureStore) {
        const value = await SecureStore.getItemAsync(key);
        if (value) return value;
        // One-time migration of tokens saved to AsyncStorage by older builds.
        const legacy = await AsyncStorage.getItem(key);
        if (legacy) {
            await SecureStore.setItemAsync(key, legacy);
            await AsyncStorage.removeItem(key);
        }
        return legacy;
    }
    return AsyncStorage.getItem(key);
};

const setItem = async (key, value) => {
    if (value === null || value === undefined) {
        return removeItem(key);
    }
    if (useSecureStore) {
        return SecureStore.setItemAsync(key, value);
    }
    return AsyncStorage.setItem(key, value);
};

const removeItem = async (key) => {
    if (useSecureStore) {
        return SecureStore.deleteItemAsync(key);
    }
    return AsyncStorage.removeItem(key);
};

export const getAccessToken = () => getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => getItem(REFRESH_TOKEN_KEY);

export const setTokens = async ({ accessToken, refreshToken }) => {
    if (accessToken !== undefined) {
        await setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken !== undefined) {
        await setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
};

export const clearTokens = async () => {
    await Promise.all([removeItem(ACCESS_TOKEN_KEY), removeItem(REFRESH_TOKEN_KEY)]);
    // Clean up tokens written to AsyncStorage by older app versions.
    if (useSecureStore) {
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    }
};

export const clearSession = async () => {
    await clearTokens();
    await AsyncStorage.removeItem(USER_KEY);
};

export const TOKEN_STORAGE_KEYS = {
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_KEY,
};
