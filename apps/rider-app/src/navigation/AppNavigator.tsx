import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSocket } from '../hooks/useSocket';
import { useAppSelector } from '../hooks/useAuth';
import type { RootStackParamList } from '../types/navigation';

import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OTPScreen } from '../screens/OTPScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AvailableOrdersScreen } from '../screens/AvailableOrdersScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { DeliveryCompleteScreen } from '../screens/DeliveryCompleteScreen';
import { EarningsScreen } from '../screens/EarningsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  useSocket();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const wasAuthenticated = useRef(isAuthenticated);

  // Session ended (logout, or token refresh failed): send the rider back to Login.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        {/* Auth screens - always present so SplashScreen can navigate.replace() to 'Login' */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OTP" component={OTPScreen} />
        {/* Authenticated screens */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="AvailableOrders"
          component={AvailableOrdersScreen}
          options={{
            title: 'Available Orders',
            headerShown: true,
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{
            title: 'Order Details',
            headerShown: true,
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="Navigation"
          component={NavigationScreen}
          options={{
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="DeliveryComplete"
          component={DeliveryCompleteScreen}
          options={{
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Earnings"
          component={EarningsScreen}
          options={{
            title: 'My Earnings',
            headerShown: true,
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'My Profile',
            headerShown: true,
            headerTitleAlign: 'center',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
