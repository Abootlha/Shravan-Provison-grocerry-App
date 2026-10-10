import React, { memo, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Chip, Text } from '../../components/ui';
import { radii, space, type } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { GROUP_RADIUS, ICON_CIRCLE } from './layout';

const PRESETS = [20, 30, 50];
const MOST_TIPPED = 30;

/**
 * Tip for the delivery partner. The order API has no tip field, so the tip is
 * not charged online: it's added to the rider's instructions and paid at the door.
 */
function TipSelectorBase({ tip, onChange, isHi }) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const [custom, setCustom] = useState(false);
    const [draft, setDraft] = useState('');

    const pickPreset = (amt) => {
        setCustom(false);
        onChange(tip === amt && !custom ? 0 : amt);
    };

    const pickCustom = () => {
        if (custom) {
            setCustom(false);
            onChange(0);
            return;
        }
        setCustom(true);
        onChange(Number(draft) || 0);
    };

    const onDraft = (text) => {
        const clean = text.replace(/[^0-9]/g, '').slice(0, 3);
        setDraft(clean);
        onChange(Number(clean) || 0);
    };

    return (
        <Card padding="lg" radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.head}>
                <View style={styles.icon}>
                    <MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.inkSecondary} />
                </View>
                <View style={styles.texts}>
                    <Text variant="title" accessibilityRole="header">
                        {isHi ? 'डिलीवरी पार्टनर को टिप दें' : 'Tip your delivery partner'}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {isHi
                            ? 'पूरी टिप पार्टनर को जाती है। दरवाज़े पर भुगतान करें।'
                            : 'All of it goes to them. Paid at the door.'}
                    </Text>
                </View>
            </View>

            <View style={styles.chips}>
                {PRESETS.map((amt) => (
                    <Chip
                        key={amt}
                        label={`₹${amt}`}
                        caption={amt === MOST_TIPPED ? (isHi ? 'सबसे ज़्यादा' : 'Most tipped') : undefined}
                        selected={!custom && tip === amt}
                        onPress={() => pickPreset(amt)}
                        style={styles.chip}
                    />
                ))}
                <Chip
                    label={isHi ? 'अन्य' : 'Custom'}
                    selected={custom}
                    onPress={pickCustom}
                    style={styles.chip}
                />
            </View>

            {custom ? (
                <Animated.View entering={layout.enterDown} exiting={layout.exit} style={styles.inputRow}>
                    <Text variant="bodyStrong">₹</Text>
                    <TextInput
                        value={draft}
                        onChangeText={onDraft}
                        keyboardType="number-pad"
                        placeholder={isHi ? 'टिप राशि' : 'Enter tip amount'}
                        placeholderTextColor={colors.inkMuted}
                        accessibilityLabel={isHi ? 'टिप राशि' : 'Custom tip amount'}
                        style={styles.input}
                        selectionColor={colors.brand}
                        autoFocus
                        maxLength={3}
                        keyboardAppearance={isDark ? 'dark' : 'light'}
                    />
                </Animated.View>
            ) : null}
        </Card>
    );
}

export const TipSelector = memo(TipSelectorBase);

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
    chip: { flexGrow: 1 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
        borderWidth: 1.5,
        borderColor: t.colors.brand,
        backgroundColor: t.colors.surface,
    },
    input: { flex: 1, ...type.bodyStrong, color: t.colors.ink, paddingVertical: space.sm, outlineStyle: 'none' },
}));

export default TipSelector;
