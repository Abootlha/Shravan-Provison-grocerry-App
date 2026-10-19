import React, { useEffect, useMemo, useRef } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../hooks/useAuth';
import { useRiderRuntime } from '../hooks/useRiderRuntime';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../types/navigation';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OTPScreen } from '../screens/OTPScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { DeliveryCompleteScreen } from '../screens/DeliveryCompleteScreen';
import { EarningsScreen } from '../screens/EarningsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  useRiderRuntime();
  const theme = useTheme();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const wasAuthenticated = useRef(isAuthenticated);

  // Session ended (logout, or token refresh failed): send the rider back to Login.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  const navTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.brand,
        background: theme.colors.bg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
      },
    };
  }, [theme]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OTP" component={OTPScreen} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="Navigation" component={NavigationScreen} />
        <Stack.Screen
          name="DeliveryComplete"
          component={DeliveryCompleteScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="Earnings" component={EarningsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
