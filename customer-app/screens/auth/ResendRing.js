/**
 * ResendRing (name kept) — the "Resend code" control. While `seconds` counts down it is a plain line
 * of text ("Resend code in 0:24", tabular numerals); at 0 it becomes a ghost Resend button.
 * No progress ring — the number already says how long is left.
 *
 * Props: seconds, total (unused, kept for callers), onResend, label ('Resend'), waitingLabel ('Resend code in'), loading
 */
import React from 'react';
import { View } from 'react-native';
import { space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { Button, Text } from '../../components/ui';

const clock = (s) => `0:${String(Math.max(0, s)).padStart(2, '0')}`;

// eslint-disable-next-line no-unused-vars -- `total` kept in the signature for old callers
export function ResendRing({ seconds, total = 30, onResend, label = 'Resend', waitingLabel = 'Resend code in', loading }) {
    const styles = useStyles();

    if (seconds <= 0) {
        return <Button variant="ghost" size="sm" label={label} loading={loading} onPress={onResend} style={styles.center} />;
    }

    return (
        <View style={styles.row} accessible accessibilityLabel={`${waitingLabel} ${seconds}`} accessibilityLiveRegion="none">
            <Text variant="label" color="muted" align="center">
                {waitingLabel} <Text variant="label" color="secondary" tabular>{clock(seconds)}</Text>
            </Text>
        </View>
    );
}

const useStyles = makeStyles(() => ({
    row: { alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingVertical: space.xs },
    center: { alignSelf: 'center' },
}));

export default ResendRing;
