import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet, Divider, PressableScale, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { getPaymentGroups } from './paymentMethods';
import { RadioRow } from './RadioRow';

const CLOSE_DELAY = 180; // let the radio land before the sheet leaves

// Wordmark-style initials for the UPI app tiles (we don't ship third-party logos).
const UPI_TILES = {
    phonepe: { mark: 'Pe', short: 'PhonePe' },
    gpay: { mark: 'G', short: 'GPay' },
    paytm: { mark: 'Pt', short: 'Paytm' },
    amazon_upi: { mark: 'a', short: 'Amazon' },
    super_upi: { mark: 'S', short: 'Super' },
};

const UpiTile = ({ option, selected, onPress }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const t = UPI_TILES[option.id];
    return (
        <PressableScale
            onPress={onPress}
            haptic="selection"
            scaleTo={press.scale}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.name}
            style={styles.tileWrap}
        >
            <View style={[styles.tile, { backgroundColor: colors.surfaceSunken }, selected && styles.tileOn]}>
                <Text variant="title" weight="bold" color="ink">{t.mark}</Text>
                {selected ? (
                    <View style={styles.tileCheck}>
                        <MaterialCommunityIcons name="check-bold" size={10} color={colors.onBrand} />
                    </View>
                ) : null}
            </View>
            <Text variant="caption" color={selected ? 'ink' : 'secondary'} weight={selected ? 'bold' : 'medium'} numberOfLines={1}>
                {t.short}
            </Text>
        </PressableScale>
    );
};

function PaymentMethodSheetBase({ visible, onClose, selected, onSelect, amount, isHi }) {
    const styles = useStyles();
    const groups = getPaymentGroups(isHi);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const choose = (id) => {
        onSelect(id);
        clearTimeout(timer.current);
        timer.current = setTimeout(onClose, CLOSE_DELAY);
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title={isHi ? 'भुगतान का तरीका चुनें' : 'Choose payment method'}
            subtitle={isHi ? `कुल देय ₹${amount}` : `To pay ₹${amount}`}
            scrollable
        >
            <View style={styles.list}>
                {groups.map((group) => {
                    const tiles = group.options.filter((o) => UPI_TILES[o.id]);
                    const rows = group.options.filter((o) => !UPI_TILES[o.id]);
                    return (
                        <View key={group.key} style={styles.group} accessibilityRole="radiogroup">
                            <Text variant="micro" color="muted" accessibilityRole="header" style={styles.groupTitle}>
                                {group.title}
                            </Text>
                            <View style={styles.box}>
                                {tiles.length ? (
                                    <View style={styles.tiles}>
                                        {tiles.map((o) => (
                                            <UpiTile key={o.id} option={o} selected={selected === o.id} onPress={() => choose(o.id)} />
                                        ))}
                                    </View>
                                ) : null}
                                {rows.map((o, i) => (
                                    <View key={o.id}>
                                        {i > 0 || tiles.length ? <Divider inset={space.md} /> : null}
                                        <RadioRow
                                            icon={o.icon}
                                            title={o.name}
                                            subtitle={o.sub}
                                            selected={selected === o.id}
                                            onPress={() => choose(o.id)}
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>
                    );
                })}
            </View>
        </BottomSheet>
    );
}

export const PaymentMethodSheet = memo(PaymentMethodSheetBase);

const TILE = 52;

const useStyles = makeStyles((t) => ({
    list: { gap: space.xl, paddingBottom: space.lg },
    group: { gap: space.sm },
    groupTitle: { marginLeft: space.xs },
    box: {
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
    },
    tiles: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: space.md,
        paddingTop: space.lg,
        paddingBottom: space.md,
    },
    tileWrap: { alignItems: 'center', gap: space.xs, width: TILE + space.sm },
    tile: {
        width: TILE,
        height: TILE,
        borderRadius: radii.well,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    tileOn: { borderColor: t.colors.brand },
    tileCheck: {
        position: 'absolute',
        top: -space.xs - 2,
        right: -space.xs - 2,
        width: 18,
        height: 18,
        borderRadius: radii.pill,
        backgroundColor: t.colors.brand,
        borderWidth: 2,
        borderColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export default PaymentMethodSheet;
