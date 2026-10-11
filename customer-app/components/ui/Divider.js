/**
 * Divider — separators.
 *
 * Props
 *   variant   'hairline' (default, 1px hairline colour) | 'thick' (8px canvas band between
 *             sections on a white page — Zomato/Blinkit style) | 'dashed' (bill details)
 *   inset     number — left inset (e.g. 72 to align with text after a thumbnail)
 *   vertical  boolean — vertical rule (height 100% of the row)
 *   spacing   number — vertical margin around the line (default 0)
 *   style
 *
 * Example
 *   <Divider inset={space.lg} />
 *   <Divider variant="thick" />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';

export function Divider({ variant = 'hairline', inset = 0, vertical = false, spacing = 0, style }) {
    const { colors } = useTheme();
    if (vertical) {
        return <View style={[{ width: 1, alignSelf: 'stretch', backgroundColor: colors.hairline, marginHorizontal: spacing }, style]} />;
    }
    if (variant === 'thick') {
        return <View style={[{ height: 8, backgroundColor: colors.canvas, marginVertical: spacing }, style]} />;
    }
    if (variant === 'dashed') {
        return (
            <View
                style={[
                    { height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginLeft: inset, marginVertical: spacing },
                    style,
                ]}
            />
        );
    }
    return (
        <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.hairline, marginLeft: inset, marginVertical: spacing }, style]} />
    );
}

export default Divider;
