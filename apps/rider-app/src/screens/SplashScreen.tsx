import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '../components/ui';
import { useAppDispatch } from '../hooks/useAuth';
import { loadUser } from '../store/slices/authSlice';
import { spacing } from '../theme';
import type { SplashScreenProps } from '../types/navigation';

const BRAND = '#6C3CF4';

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await dispatch(loadUser());
      const hasSession = loadUser.fulfilled.match(result) && Boolean(result.payload?.user);
      if (active) navigation.replace(hasSession ? 'Home' : 'Login');
    })();
    return () => {
      active = false;
    };
  }, [dispatch, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <MaterialCommunityIcons name="moped" size={44} color={BRAND} />
      </View>
      <AppText variant="h1" color="#FFFFFF" style={{ marginTop: spacing.lg }}>
        ShravanKirana
      </AppText>
      <AppText variant="body" color="rgba(255,255,255,0.8)" style={{ marginTop: spacing.xs }}>
        Delivery Partner
      </AppText>
      <ActivityIndicator color="#FFFFFF" style={styles.loader} accessibilityLabel="Loading" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { position: 'absolute', bottom: 80 },
});
