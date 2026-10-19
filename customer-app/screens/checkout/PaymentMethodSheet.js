import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet, Divider, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { getPaymentGroups } from './paymentMethods';
import { RadioRow } from './RadioRow';

const CLOSE_DELAY = 180; // let the radio land before the sheet leaves

/**
 * Payment method picker. Online methods are categories (UPI, card, net banking): PayU's secure
 * page asks for the app, card or bank, so we never show third-party logos we don't ship.
 */
function PaymentMethodSheetBase({ visible, onClose, selected, onSelect, amount, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
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
            subtitle={amount != null ? (isHi ? `कुल देय ₹${amount}` : `To pay ₹${amount}`) : undefined}
            scrollable
        >
            <View style={styles.list}>
                {groups.map((group) => (
                    <View key={group.key} style={styles.group} accessibilityRole="radiogroup">
                        <Text variant="label" color="secondary" accessibilityRole="header" style={styles.groupTitle}>
                            {group.title}
                        </Text>
                        <View style={styles.box}>
                            {group.options.map((o, i) => (
                                <View key={o.id}>
                                    {i > 0 ? <Divider inset={space.md} /> : null}
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
                ))}
                <View style={styles.note}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={16} color={colors.inkMuted} />
                    <Text variant="caption" color="muted" style={styles.flex}>
                        {isHi
                            ? 'ऑनलाइन भुगतान PayU के सुरक्षित पेज पर होता है। हम आपके कार्ड या UPI की जानकारी सेव नहीं करते।'
                            : 'Online payments open PayU’s secure page. We don’t store your card or UPI details.'}
                    </Text>
                </View>
            </View>
        </BottomSheet>
    );
}

export const PaymentMethodSheet = memo(PaymentMethodSheetBase);

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
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.xs },
    flex: { flex: 1 },
}));

export default PaymentMethodSheet;
