import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../utils/constants';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
  loading?: boolean;
}

export const OnlineToggle: React.FC<OnlineToggleProps> = ({
  isOnline,
  onToggle,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{isOnline ? 'Online' : 'Offline'}</Text>
        <Text style={styles.subtitle}>
          {isOnline ? 'You are visible to customers' : 'You are hidden from customers'}
        </Text>
      </View>
      <Switch
        value={isOnline}
        onValueChange={onToggle}
        disabled={loading}
        trackColor={{ false: COLORS.disabled, true: COLORS.success }}
        thumbColor={COLORS.surface}
        ios_backgroundColor={COLORS.disabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
