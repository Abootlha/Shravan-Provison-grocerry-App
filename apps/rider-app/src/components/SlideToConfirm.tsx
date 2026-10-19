import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText } from './ui';
import { radii, useTheme } from '../theme';

const HEIGHT = 64;
const KNOB = 54;
const PAD = (HEIGHT - KNOB) / 2;
const COMPLETE_AT = 0.85;

type Props = {
  label: string;
  /** Resolve false (or throw) to slide back so the rider can try again. */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  tone?: 'brand' | 'success';
  disabled?: boolean;
  testID?: string;
};

/**
 * Slide-to-confirm for irreversible steps (pickup, delivery). A deliberate
 * drag is hard to trigger by accident in a pocket or on a bumpy road.
 * Screen readers get a plain "activate" action instead of the drag.
 */
export const SlideToConfirm: React.FC<Props> = ({ label, onConfirm, tone = 'brand', disabled, testID }) => {
  const { colors: c } = useTheme();
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const maxX = Math.max(0, width - KNOB - PAD * 2);
  const maxRef = useRef(maxX);
  maxRef.current = maxX;
  const busyRef = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const fill = tone === 'success' ? c.success : c.brand;
  const soft = tone === 'success' ? c.successSoft : c.brandSoft;
  const text = tone === 'success' ? c.successText : c.brandText;

  const reset = () => {
    Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
  };

  const finish = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    let ok = true;
    try {
      ok = (await confirmRef.current()) !== false;
    } catch {
      ok = false;
    }
    busyRef.current = false;
    setBusy(false);
    if (!ok) reset();
  };

  // Snap back if the step changes (new label) or the control is re-enabled.
  useEffect(() => {
    x.setValue(0);
  }, [label, x]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !busyRef.current,
      onMoveShouldSetPanResponder: (_, g) => !disabledRef.current && !busyRef.current && Math.abs(g.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        Haptics.selectionAsync().catch(() => undefined);
      },
      onPanResponderMove: (_, g) => {
        x.setValue(Math.min(Math.max(0, g.dx), maxRef.current));
      },
      onPanResponderRelease: (_, g) => {
        if (maxRef.current > 0 && g.dx >= maxRef.current * COMPLETE_AT) {
          Animated.timing(x, {
            toValue: maxRef.current,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }).start(() => finish());
        } else {
          reset();
        }
      },
      onPanResponderTerminate: () => reset(),
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const labelOpacity = x.interpolate({
    inputRange: [0, Math.max(1, maxX * 0.6)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const trailWidth = Animated.add(x, KNOB + PAD * 2);

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Slide right to confirm"
      accessibilityState={{ disabled: Boolean(disabled), busy }}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !disabled) finish();
      }}
      style={[styles.track, { backgroundColor: soft, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.View style={[styles.trail, { width: trailWidth, backgroundColor: fill, opacity: 0.18 }]} />
      <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]} pointerEvents="none">
        <AppText variant="h3" weight="bold" color={text} numberOfLines={1}>
          {busy ? 'Please wait…' : label}
        </AppText>
        {!busy ? <MaterialCommunityIcons name="chevron-double-right" size={22} color={text} /> : null}
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.knob, { backgroundColor: fill, transform: [{ translateX: x }] }]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons name="arrow-right" size={28} color="#FFFFFF" />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: radii.pill,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: KNOB,
  },
  knob: {
    position: 'absolute',
    left: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
