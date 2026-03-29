import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../utils/constants';
import type { Coordinates } from '../types/order';

interface MapViewProps {
  pickup?: Coordinates;
  delivery?: Coordinates;
  currentLocation?: Coordinates | null;
  route?: Coordinates[];
  showRoute?: boolean;
}

const CoordinateRow: React.FC<{ label: string; value?: Coordinates | null }> = ({ label, value }) => (
  <View style={styles.coordinateRow}>
    <Text style={styles.coordinateLabel}>{label}</Text>
    <Text style={styles.coordinateValue}>
      {value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}` : 'Not available'}
    </Text>
  </View>
);

export const MapViewComponent: React.FC<MapViewProps> = ({
  pickup,
  delivery,
  currentLocation,
  route = [],
  showRoute = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.placeholderCard}>
        <Text style={styles.title}>Map Preview</Text>
        <Text style={styles.subtitle}>
          Live map rendering is available on the native rider app. Web shows route details only.
        </Text>

        <CoordinateRow label="Current" value={currentLocation} />
        <CoordinateRow label="Pickup" value={pickup} />
        <CoordinateRow label="Delivery" value={delivery} />

        {showRoute && route.length > 0 && (
          <Text style={styles.routeText}>Route points loaded: {route.length}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  placeholderCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  coordinateRow: {
    gap: 4,
    paddingVertical: 6,
  },
  coordinateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  coordinateValue: {
    fontSize: 15,
    color: COLORS.text,
  },
  routeText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
});
