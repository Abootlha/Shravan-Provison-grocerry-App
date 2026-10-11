import React, { memo } from 'react';
import { TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Chip, Text } from '../../components/ui';
import { radii, space, type } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { GROUP_RADIUS, ICON_CIRCLE } from './layout';
import { getInstructionOptions } from './useCheckout';

/** Sent as the order's deliveryInstructions. */
function DeliveryInstructionsCardBase({ selected, onToggle, note, onChangeNote, isHi }) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const options = getInstructionOptions(isHi);
    return (
        <Card padding="lg" radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.head}>
                <View style={styles.icon}>
                    <MaterialCommunityIcons name="message-text-outline" size={20} color={colors.inkSecondary} />
                </View>
                <View style={styles.texts}>
                    <Text variant="title" accessibilityRole="header">
                        {isHi ? 'डिलीवरी निर्देश' : 'Delivery instructions'}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {isHi ? 'पार्टनर को बताएं कि कैसे पहुँचाना है' : 'Tell your partner how to hand it over'}
                    </Text>
                </View>
            </View>
            <View style={styles.chips}>
                {options.map((o) => (
                    <Chip
                        key={o.id}
                        size="sm"
                        label={o.label}
                        selected={selected.includes(o.id)}
                        onPress={() => onToggle(o.id)}
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name={o.icon} size={size} color={color} />}
                    />
                ))}
            </View>
            <TextInput
                value={note}
                onChangeText={onChangeNote}
                placeholder={isHi ? 'और कुछ? जैसे लिफ्ट का उपयोग करें' : 'Anything else? e.g. Use the side gate'}
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel={isHi ? 'अतिरिक्त निर्देश' : 'Additional instructions'}
                style={styles.input}
                selectionColor={colors.brand}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                maxLength={200}
                multiline
            />
        </Card>
    );
}

export const DeliveryInstructionsCard = memo(DeliveryInstructionsCardBase);

const useStyles = makeStyles((t) => ({
    card: { gap: space.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    icon: {
        width: ICON_CIRCLE + space.xs,
        height: ICON_CIRCLE + space.xs,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    input: {
        ...type.body,
        color: t.colors.ink,
        minHeight: 48,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        borderRadius: radii.input,
        backgroundColor: t.colors.surfaceSunken,
        textAlignVertical: 'top',
        outlineStyle: 'none',
    },
}));

export default DeliveryInstructionsCard;
