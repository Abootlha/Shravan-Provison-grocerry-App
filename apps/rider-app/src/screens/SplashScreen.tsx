import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../utils/constants';
import type { SplashScreenProps } from '../types/navigation';

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SK</Text>
      <Text style={styles.title}>ShravanKirana</Text>
      <Text style={styles.subtitle}>Rider App</Text>
      <ActivityIndicator size="large" color={COLORS.surface} style={styles.loader} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 72,
    fontWeight: '700',
    color: COLORS.surface,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.surface,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.surface,
    opacity: 0.8,
    marginBottom: 48,
  },
  loader: {
    position: 'absolute',
    bottom: 100,
  },
});
