import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, ORDER_STATUS_LABELS } from '../utils/constants';
import type { OrderStatus } from '../types/order';

interface StatusStepperProps {
  currentStatus: OrderStatus;
}

const statuses: OrderStatus[] = ['assigned', 'in_transit', 'delivered'];

export const StatusStepper: React.FC<StatusStepperProps> = ({ currentStatus }) => {
  const currentIndex = statuses.indexOf(currentStatus);

  return (
    <View style={styles.container}>
      {statuses.map((status, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={status}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isCurrent && styles.circleCurrent,
                ]}
              >
                {isCompleted && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  isCompleted && styles.labelCompleted,
                  isCurrent && styles.labelCurrent,
                ]}
              >
                {ORDER_STATUS_LABELS[status]}
              </Text>
            </View>
            {index < statuses.length - 1 && (
              <View
                style={[
                  styles.line,
                  index < currentIndex && styles.lineCompleted,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  stepContainer: {
    alignItems: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCompleted: {
    backgroundColor: COLORS.success,
  },
  circleCurrent: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  checkmark: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  labelCompleted: {
    color: COLORS.success,
  },
  labelCurrent: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.disabled,
    marginHorizontal: 4,
    marginBottom: 24,
  },
  lineCompleted: {
    backgroundColor: COLORS.success,
  },
});
