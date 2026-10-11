import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from './src/hooks/useAuth';
import { loadUser, sessionExpired, tokenRefreshed } from './src/store/slices/authSlice';
import { notificationService } from './src/services/notifications';
import {
  SESSION_ENDED_MESSAGE,
  ensureFreshAccessToken,
  setSessionHandlers,
} from './src/services/authSession';
import { socketService } from './src/services/socket';
import { locationService } from './src/services/location';
import { storage } from './src/services/storage';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  useEffect(() => {
    setSessionHandlers({
      onTokenRefreshed: (token) => dispatch(tokenRefreshed(token)),
      // Only a 401 from /auth/refresh lands here; offline never logs a rider out.
      onSessionExpired: () => {
        locationService.stopTracking();
        locationService.stopBackgroundTracking().catch(() => undefined);
        socketService.disconnect();
        // The UI shows the notice now; don't show it again on the next start.
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
    ensureFreshAccessToken().catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensureFreshAccessToken().catch(() => undefined);
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    notificationService.requestPermissions().catch(() => {
      // Notifications are optional; keep app startup resilient.
    });
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </Provider>
  );
}
