import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
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

export const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  useSocket();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
          </>
        ) : (
          <>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
