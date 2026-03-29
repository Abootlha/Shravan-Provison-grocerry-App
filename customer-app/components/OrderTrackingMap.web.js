import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

const OrderTrackingMap = ({
  riderLocation,
  customerLocation,
  storeLocation,
  orderStatus,
  onMapReady,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onMapReady?.();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [onMapReady, pulseAnim]);

  const getStatusText = () => {
    switch (orderStatus) {
      case 'OUT_FOR_DELIVERY':
      case 'ASSIGNED':
        return 'Live delivery tracking is active';
      case 'PACKED':
        return 'Order packed, rider assignment in progress';
      default:
        return 'Tracking details will appear here once delivery starts';
    }
  };

  const formatCoord = (label, coord) => {
    if (!coord?.latitude || !coord?.longitude) {
      return null;
    }

    return (
      <View style={styles.coordRow}>
        <Text style={styles.coordLabel}>{label}</Text>
        <Text style={styles.coordText}>
          {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.grid} />
      <Animated.View style={[styles.heroIcon, { transform: [{ scale: pulseAnim }] }]}>
        <MaterialCommunityIcons
          name={orderStatus === 'OUT_FOR_DELIVERY' ? 'bike-fast' : 'map-marker-path'}
          size={44}
          color={COLORS.secondary}
        />
      </Animated.View>

      <Text style={styles.title}>{getStatusText()}</Text>
      <Text style={styles.subtitle}>
        Web preview uses a lightweight tracking panel instead of native maps.
      </Text>

      <View style={styles.card}>
        {formatCoord('Store', storeLocation)}
        {formatCoord('Customer', customerLocation)}
        {formatCoord('Rider', riderLocation)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    backgroundColor: '#F8FAFC',
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  coordRow: {
    gap: 4,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordText: {
    fontSize: 14,
    color: COLORS.text,
  },
});

export default OrderTrackingMap;
