import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  elevation,
  font,
  FontWeightName,
  radii,
  spacing,
  Theme,
  TOUCH_TARGET,
  typeScale,
  TypeVariant,
  useTheme,
} from '../theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const tapHaptic = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

/* ------------------------------------------------------------------ Text */

type TextTone = 'default' | 'muted' | 'subtle' | 'brand' | 'success' | 'warning' | 'danger' | 'onBrand';

const toneColor = (theme: Theme, tone: TextTone) =>
  ({
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    subtle: theme.colors.textSubtle,
    brand: theme.colors.brandText,
    success: theme.colors.successText,
    warning: theme.colors.warningText,
    danger: theme.colors.dangerText,
    onBrand: theme.colors.textOnBrand,
  })[tone];

const defaultWeight: Record<TypeVariant, FontWeightName> = {
  display: 'extrabold',
  h1: 'bold',
  h2: 'bold',
  h3: 'semibold',
  body: 'regular',
  bodySm: 'regular',
  caption: 'medium',
  overline: 'semibold',
};

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  weight?: FontWeightName;
  tone?: TextTone;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Fixed-width digits for amounts and timers. */
  numeric?: boolean;
  uppercase?: boolean;
};

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  weight,
  tone = 'default',
  color,
  align,
  numeric,
  uppercase,
  style,
  ...rest
}) => {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        typeScale[variant],
        font(weight ?? defaultWeight[variant]),
        { color: color ?? toneColor(theme, tone) },
        align ? { textAlign: align } : null,
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        uppercase ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    />
  );
};

/* ---------------------------------------------------------------- Button */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth = true,
  style,
  accessibilityHint,
  testID,
}) => {
  const theme = useTheme();
  const c = theme.colors;
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; pressed: string }> = {
    primary: { bg: c.brand, fg: c.textOnBrand, pressed: c.brandPressed },
    secondary: { bg: c.brandSoft, fg: c.brandText, pressed: c.border },
    outline: { bg: 'transparent', fg: c.text, border: c.borderStrong, pressed: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.brandText, pressed: c.surfaceAlt },
    danger: { bg: c.danger, fg: '#FFFFFF', pressed: c.dangerText },
    success: { bg: c.success, fg: '#FFFFFF', pressed: c.successText },
  };
  const p = palette[variant];
  const inactive = disabled || loading;
  const height = size === 'lg' ? 56 : 46;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={() => {
        tapHaptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          minHeight: Math.min(height, TOUCH_TARGET),
          borderRadius: radii.md,
          paddingHorizontal: spacing.xl,
          backgroundColor: pressed ? p.pressed : p.bg,
          borderWidth: p.border ? 1.5 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled && !loading ? 0.45 : 1,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={size === 'lg' ? 22 : 19} color={p.fg} /> : null}
          <AppText variant={size === 'lg' ? 'h3' : 'body'} weight="bold" color={p.fg} numberOfLines={1}>
            {label}
          </AppText>
          {iconRight ? <MaterialCommunityIcons name={iconRight} size={20} color={p.fg} /> : null}
        </>
      )}
    </Pressable>
  );
};

/* ------------------------------------------------------------ IconButton */

export const IconButton: React.FC<{
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'default' | 'brand' | 'success' | 'danger';
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, label, onPress, tone = 'default', size = TOUCH_TARGET, filled = true, disabled, style }) => {
  const theme = useTheme();
  const c = theme.colors;
  const fg = { default: c.text, brand: c.brandText, success: c.successText, danger: c.dangerText }[tone];
  const bg = { default: c.surfaceAlt, brand: c.brandSoft, success: c.successSoft, danger: c.dangerSoft }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        tapHaptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? bg : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.46)} color={fg} />
    </Pressable>
  );
};

/* ------------------------------------------------------------------ Card */

export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  raised?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}> = ({ children, style, padded = true, raised = false, onPress, accessibilityLabel }) => {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: radii.lg,
    padding: padded ? spacing.lg : 0,
    ...(raised ? elevation(theme, 1) : { borderWidth: 1, borderColor: theme.colors.border }),
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
};

/* ------------------------------------------------------------------ Pill */

export type PillTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export const Pill: React.FC<{ label: string; tone?: PillTone; icon?: IconName; style?: StyleProp<ViewStyle> }> = ({
  label,
  tone = 'neutral',
  icon,
  style,
}) => {
  const { colors: c } = useTheme();
  const map: Record<PillTone, [string, string]> = {
    neutral: [c.surfaceAlt, c.textMuted],
    brand: [c.brandSoft, c.brandText],
    success: [c.successSoft, c.successText],
    warning: [c.warningSoft, c.warningText],
    danger: [c.dangerSoft, c.dangerText],
    info: [c.infoSoft, c.info],
  };
  const [bg, fg] = map[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          backgroundColor: bg,
          borderRadius: radii.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        style,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={fg} /> : null}
      <AppText variant="caption" weight="bold" color={fg}>
        {label}
      </AppText>
    </View>
  );
};

/* ---------------------------------------------------------------- Banner */

export const Banner: React.FC<{
  tone?: 'info' | 'warning' | 'danger' | 'success';
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ tone = 'info', icon, title, message, actionLabel, onAction, onDismiss, style }) => {
  const { colors: c } = useTheme();
  const map = {
    info: { bg: c.infoSoft, fg: c.info, icon: 'information' as IconName },
    warning: { bg: c.warningSoft, fg: c.warningText, icon: 'alert' as IconName },
    danger: { bg: c.dangerSoft, fg: c.dangerText, icon: 'alert-circle' as IconName },
    success: { bg: c.successSoft, fg: c.successText, icon: 'check-circle' as IconName },
  }[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: map.bg,
          borderRadius: radii.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon ?? map.icon} size={22} color={map.fg} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodySm" weight="bold" color={map.fg}>
          {title}
        </AppText>
        {message ? (
          <AppText variant="bodySm" color={map.fg} style={{ opacity: 0.9, marginTop: 2 }}>
            {message}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={10}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.sm,
            backgroundColor: c.surface,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <AppText variant="bodySm" weight="bold" color={map.fg}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={20} color={map.fg} />
        </Pressable>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------ EmptyState */

export const EmptyState: React.FC<{
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, title, message, actionLabel, onAction, loading, style }) => {
  const { colors: c } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }, style]}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <MaterialCommunityIcons name={icon} size={30} color={c.textSubtle} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="bodySm" tone="muted" align="center" style={{ marginTop: spacing.xs, maxWidth: 300 }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="secondary"
          size="md"
          fullWidth={false}
          loading={loading}
          onPress={onAction}
          style={{ marginTop: spacing.lg, alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
};

/* -------------------------------------------------------------- Skeleton */

export const Skeleton: React.FC<{
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ height, width = '100%', radius = radii.md, style }) => {
  const { colors: c } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: radius, backgroundColor: c.surfaceAlt, opacity }, style]}
    />
  );
};

/* ----------------------------------------------------------- ScreenHeader */

export const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  transparent?: boolean;
}> = ({ title, subtitle, onBack, right, transparent }) => {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: transparent ? 'transparent' : c.surface,
        borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {onBack ? <IconButton icon="arrow-left" label="Go back" onPress={onBack} size={44} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="h2" numberOfLines={1} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
};

/* ------------------------------------------------------- Small helpers */

export const Divider: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { colors: c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }, style]} />;
};

export const SectionTitle: React.FC<{ title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  title,
  right,
  style,
}) => (
  <View
    style={[
      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
      style,
    ]}
  >
    <AppText variant="overline" tone="subtle">
      {title}
    </AppText>
    {right}
  </View>
);

export const Row: React.FC<{
  icon?: IconName;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}> = ({ icon, label, value, right, onPress }) => {
  const { colors: c } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH_TARGET, gap: spacing.md }}>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={c.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="medium">
          {label}
        </AppText>
        {value ? (
          <AppText variant="bodySm" tone="muted">
            {value}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={22} color={c.textSubtle} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
};
