import React, { forwardRef, useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, IconName } from './ui';
import { font, radii, spacing, TOUCH_TARGET, useTheme } from '../theme';

type Props = TextInputProps & {
  label: string;
  icon?: IconName;
  error?: string | null;
  hint?: string;
  prefix?: string;
  /** Adds a show/hide toggle for passwords. */
  secureToggle?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(
  ({ label, icon, error, hint, prefix, secureToggle, style, editable = true, ...rest }, ref) => {
    const { colors: c } = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    const borderColor = error ? c.danger : focused ? c.brand : c.borderStrong;
    return (
      <View style={{ gap: 6 }}>
        <AppText variant="bodySm" weight="semibold" tone="muted">
          {label}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: TOUCH_TARGET + 4,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor,
            backgroundColor: editable ? c.surface : c.surfaceAlt,
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
          }}
        >
          {icon ? <MaterialCommunityIcons name={icon} size={20} color={focused ? c.brand : c.textSubtle} /> : null}
          {prefix ? (
            <AppText variant="body" weight="semibold" tone="muted">
              {prefix}
            </AppText>
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={c.textSubtle}
            editable={editable}
            accessibilityLabel={label}
            {...rest}
            secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            style={[
              font('medium'),
              { flex: 1, fontSize: 16, color: editable ? c.text : c.textMuted, paddingVertical: spacing.md },
              style,
            ]}
          />
          {secureToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
              onPress={() => setHidden((v) => !v)}
              hitSlop={12}
            >
              <MaterialCommunityIcons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color={c.textSubtle}
              />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        ) : hint ? (
          <AppText variant="caption" tone="subtle">
            {hint}
          </AppText>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
