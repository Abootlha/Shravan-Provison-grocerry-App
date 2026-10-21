import React, { useEffect, useState } from 'react';
import { AppState, LogBox, View } from 'react-native';

LogBox.ignoreLogs([
  'Background location is limited in Expo Go',
  'Cannot connect to Expo CLI',
]);
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { store } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from './src/hooks/useAuth';
import { sessionExpired, tokenRefreshed } from './src/store/slices/authSlice';
import { notificationService } from './src/services/notifications';
import { SESSION_ENDED_MESSAGE, ensureFreshAccessToken, setSessionHandlers } from './src/services/authSession';
import { storage } from './src/services/storage';
import { setFontsReady, useTheme } from './src/theme';

/** Never hold the app hostage to a font download. */
const FONT_TIMEOUT_MS = 4000;

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();

  useEffect(() => {
    setSessionHandlers({
      onTokenRefreshed: (token) => dispatch(tokenRefreshed(token)),
      // Only a 401 from /auth/refresh lands here; offline never logs a rider out.
      // The rider runtime (navigator) stops tracking and the socket on sign-out.
      onSessionExpired: () => {
        storage.takeSessionNotice().catch(() => undefined);
        dispatch(sessionExpired(SESSION_ENDED_MESSAGE));
      },
    });
    return () => setSessionHandlers({});
  }, [dispatch]);

  // Persistent login: renew the access token in the background after start-up
  // and whenever the app returns to the foreground.
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    ensureFreshAccessToken()
      .then((token) => {
        if (token) dispatch(tokenRefreshed(token));
      })
      .catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensureFreshAccessToken().catch(() => undefined);
    });
    return () => sub.remove();
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Needed for new-order alerts while the app is in the background.
    notificationService.requestPermissions().catch(() => undefined);
  }, [isAuthenticated]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <AppNavigator />
    </View>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || Boolean(fontError) || timedOut;
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#6C3CF4' }} />;
  }
  setFontsReady(fontsLoaded);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </Provider>
  );
}
