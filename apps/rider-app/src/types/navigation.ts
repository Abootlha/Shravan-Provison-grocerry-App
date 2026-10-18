import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Order } from './order';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  /** Without a phone the screen asks for one first. */
  OTP: { phone?: string; otpLength?: number } | undefined;
  Home: undefined;
  OrderDetail: { orderId: string };
  Navigation: { orderId: string };
  DeliveryComplete: { order: Order };
  Earnings: undefined;
  Profile: undefined;
};

export type SplashScreenProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;
export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;
export type OTPScreenProps = NativeStackScreenProps<RootStackParamList, 'OTP'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type OrderDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;
export type NavigationScreenProps = NativeStackScreenProps<RootStackParamList, 'Navigation'>;
export type DeliveryCompleteScreenProps = NativeStackScreenProps<RootStackParamList, 'DeliveryComplete'>;
export type EarningsScreenProps = NativeStackScreenProps<RootStackParamList, 'Earnings'>;
export type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
