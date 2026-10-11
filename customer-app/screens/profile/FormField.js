/**
 * FormField — labelled text input on the sunken fill (radius 10, hairline border). While focused the
 * fill lifts to surface and the border turns violet (the focus ring). Locked fields keep the sunken
 * fill, drop the border and show a lock glyph. Theme-aware (dark keyboard on iOS in dark mode).
 *
 * Props: label, icon (MCI name), value, onChangeText, editable (default true), badge (element),
 *        help (string), plus any TextInput prop.
 */
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space, type } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { Text } from '../../components/ui';

export function FormField({ label, icon, value, onChangeText, editable = true, badge, help, ...rest }) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const [focused, setFocused] = useState(false);
    return (
        <View style={styles.wrap}>
            <View style={styles.labelRow}>
                <Text variant="label" color="secondary">{label}</Text>
                {badge}
            </View>
            <View style={[styles.input, focused && styles.focused, !editable && styles.locked]}>
                {icon ? <MaterialCommunityIcons name={icon} size={20} color={editable ? colors.inkSecondary : colors.inkMuted} /> : null}
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    editable={editable}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholderTextColor={colors.inkMuted}
                    selectionColor={colors.brand}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    style={[styles.text, !editable && styles.lockedText]}
                    accessibilityLabel={label}
                    {...rest}
                />
                {!editable ? <MaterialCommunityIcons name="lock-outline" size={18} color={colors.inkMuted} /> : null}
            </View>
            {help ? <Text variant="caption" color="muted">{help}</Text> : null}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    wrap: { gap: space.xs },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    input: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 52,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surfaceSunken,
    },
    focused: { borderColor: t.colors.brand, backgroundColor: t.colors.surface },
    locked: { borderColor: 'transparent' },
    text: { flex: 1, ...type.body, fontSize: type.title.fontSize, color: t.colors.ink, paddingVertical: space.sm, outlineStyle: 'none' },
    lockedText: { color: t.colors.inkSecondary },
}));

export default FormField;
