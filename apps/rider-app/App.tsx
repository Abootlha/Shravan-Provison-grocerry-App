import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from './src/hooks/useAuth';
import { loadUser } from './src/store/slices/authSlice';
import { socketService } from './src/services/socket';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const user = store.getState().auth.user;
      socketService.connect(token, user?.id);
    }
    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, token]);

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
