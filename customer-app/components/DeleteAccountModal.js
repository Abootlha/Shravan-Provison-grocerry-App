/**
 * DeleteAccountModal — honest account-deletion sheet. The backend has no self-serve delete endpoint
 * yet, so this sheet does NOT claim to delete anything: it explains that confirming only logs the
 * user out, and that permanent deletion of the account and its data is done by store support
 * (phone from GET /settings/store → contactPhone, tappable when available).
 *
 * Props: visible, onClose, onConfirm (logs out), isDeleting (logging out in progress)
 */
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { BottomSheet, Button, Text } from './ui';
import { useTranslation } from '../hooks/useTranslation';
import { SettingsService } from '../services';

const KEPT = [
    { icon: 'receipt-text-outline', en: 'Past orders and receipts', hi: 'पुराने ऑर्डर और रसीदें' },
    { icon: 'map-marker-outline', en: 'Saved addresses', hi: 'सहेजे गए पते' },
    { icon: 'account-outline', en: 'Your name, phone and email', hi: 'आपका नाम, फ़ोन और ईमेल' },
];

// +919876543210 / 9876543210 → "+91 98765 43210" (anything else is shown as given).
const formatPhone = (p) => {
    const d = String(p).replace(/[^\d]/g, '');
    const local = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 10 ? d : null;
    return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : String(p);
};

const DeleteAccountModal = ({ visible, onClose, onConfirm, isDeleting = false }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const { isHi } = useTranslation();
    const [phone, setPhone] = useState(null);

    useEffect(() => {
        if (!visible || phone) return undefined;
        let alive = true;
        SettingsService.getStoreSettings()
            .then((data) => {
                const p = (data?.settings || data)?.contactPhone;
                if (alive && p) setPhone(String(p));
            })
            .catch(() => {});
        return () => { alive = false; };
    }, [visible, phone]);

    const callSupport = () => {
        if (!phone) return;
        Linking.openURL(`tel:${phone}`).catch(() => {});
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            floating
            dismissible={!isDeleting}
            footer={
                <View style={styles.actions}>
                    <Button
                        variant="danger"
                        size="lg"
                        fullWidth
                        loading={isDeleting}
                        label={isHi ? 'लॉग आउट करें' : 'Log out'}
                        onPress={onConfirm}
                        haptic="warning"
                    />
                    <Button
                        variant="ghost"
                        fullWidth
                        disabled={isDeleting}
                        label={isHi ? 'रहने दें' : 'Not now'}
                        onPress={onClose}
                    />
                </View>
            }
        >
            <View style={styles.body}>
                <Text variant="h3" accessibilityRole="header">
                    {isHi ? 'खाता हटाना चाहते हैं?' : 'Want to delete your account?'}
                </Text>
                <Text variant="body" color="secondary">
                    {isHi
                        ? 'यह बटन आपको सिर्फ़ लॉग आउट करता है। अपना खाता और डेटा हमेशा के लिए हटवाने के लिए सपोर्ट से संपर्क करें'
                        : 'This logs you out. To permanently delete your account and data, contact support'}
                    {phone ? (isHi ? ` (${formatPhone(phone)})।` : ` at ${formatPhone(phone)}.`) : (isHi ? '।' : '.')}
                </Text>
                <Text variant="caption" color="muted">
                    {isHi ? 'तब तक यह सब आपके खाते में रहेगा:' : 'Until then, these stay with your account:'}
                </Text>
                <View style={styles.list}>
                    {KEPT.map((item) => (
                        <View key={item.icon} style={styles.item}>
                            <MaterialCommunityIcons name={item.icon} size={20} color={colors.inkSecondary} />
                            <Text variant="body" style={styles.flex}>{isHi ? item.hi : item.en}</Text>
                        </View>
                    ))}
                </View>
                {phone ? (
                    <Button
                        variant="soft"
                        size="sm"
                        align="start"
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="phone-outline" size={size} color={color} />}
                        label={isHi ? 'सपोर्ट को कॉल करें' : 'Call support'}
                        onPress={callSupport}
                        disabled={isDeleting}
                    />
                ) : null}
            </View>
        </BottomSheet>
    );
};

const useStyles = makeStyles(() => ({
    flex: { flex: 1 },
    body: { gap: space.md, paddingTop: space.md, paddingBottom: space.md },
    list: { gap: space.md, paddingVertical: space.xs },
    item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    actions: { gap: space.xs },
}));

export default DeleteAccountModal;
