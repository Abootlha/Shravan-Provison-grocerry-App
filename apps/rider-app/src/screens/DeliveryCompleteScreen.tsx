import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import type { DeliveryCompleteScreenProps } from '../types/navigation';

export const DeliveryCompleteScreen: React.FC<DeliveryCompleteScreenProps> = ({
  navigation,
  route,
}) => {
  const { order, tip } = route.params;
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation, scaleAnim, opacityAnim]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={styles.icon}>✓</Text>
        </Animated.View>

        <Animated.View style={[styles.textContainer, { opacity: opacityAnim }]}>
          <Text style={styles.title}>Delivery Complete!</Text>
          <Text style={styles.subtitle}>
            Order #{order.orderNumber} has been delivered successfully
          </Text>
        </Animated.View>

        <Animated.View style={[styles.earningsCard, { opacity: opacityAnim }]}>
          <Text style={styles.earningsLabel}>You Earned</Text>
          <Text style={styles.earningsValue}>
            ₹{(order.deliveryFee + (tip || 0)).toFixed(2)}
          </Text>
          <View style={styles.breakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Delivery Fee</Text>
              <Text style={styles.breakdownValue}>₹{order.deliveryFee.toFixed(2)}</Text>
            </View>
            {tip && tip > 0 && (
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Tip</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.success }]}>
                  +₹{tip.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: opacityAnim }]}>
          <Text style={styles.footerText}>Redirecting to home...</Text>
          <Text style={styles.skipText}>Tap anywhere to continue</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.success,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    color: COLORS.success,
    fontWeight: '700',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    opacity: 0.9,
    textAlign: 'center',
  },
  earningsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  earningsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  earningsValue: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: 16,
  },
  breakdown: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.surface,
    opacity: 0.8,
  },
  skipText: {
    fontSize: 12,
    color: COLORS.surface,
    opacity: 0.6,
    marginTop: 4,
  },
});
