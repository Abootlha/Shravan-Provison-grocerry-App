import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Order } from './order';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  OTP: { phone: string; name?: string; isNewAccount?: boolean };
  Home: undefined;
  AvailableOrders: undefined;
  OrderDetail: { orderId: string; order?: Order };
  Navigation: { orderId: string; order: Order };
  DeliveryComplete: { order: Order; tip?: number };
  Earnings: undefined;
  Profile: undefined;
};

export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type OTPScreenProps = NativeStackScreenProps<RootStackParamList, 'OTP'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type AvailableOrdersScreenProps = NativeStackScreenProps<RootStackParamList, 'AvailableOrders'>;
export type OrderDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;
export type NavigationScreenProps = NativeStackScreenProps<RootStackParamList, 'Navigation'>;
export type DeliveryCompleteScreenProps = NativeStackScreenProps<RootStackParamList, 'DeliveryComplete'>;
export type EarningsScreenProps = NativeStackScreenProps<RootStackParamList, 'Earnings'>;
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
