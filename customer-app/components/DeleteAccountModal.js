import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    TouchableWithoutFeedback,
} from 'react-native';
import {
    Alert01Icon,
    ShoppingBag01Icon,
    CrownIcon,
    Location01Icon,
    Cancel01Icon,
} from 'hugeicons-react-native';
import { useTranslation } from '../hooks/useTranslation';

const DeleteAccountModal = ({
    visible,
    onClose,
    onConfirm,
    isDeleting = false,
}) => {
    const { isHi } = useTranslation();

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.bottomSheetContainer}>
                            {/* Drag Indicator Handle */}
                            <View style={styles.handleBar} />

                            {/* Close Button Top Right */}
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={onClose}
                                activeOpacity={0.75}
                            >
                                <Cancel01Icon size={18} color="#6B7280" strokeWidth={2} />
                            </TouchableOpacity>

                            {/* Warning Glowing Icon Circle */}
                            <View style={styles.iconCircleContainer}>
                                <View style={styles.outerGlowRing}>
                                    <View style={styles.iconBadge}>
                                        <Alert01Icon size={36} color="#EF4444" strokeWidth={2.2} />
                                    </View>
                                </View>
                            </View>

                            {/* Heading & Subtitle */}
                            <Text style={styles.modalTitle}>
                                {isHi ? 'आपको जाते देख दुख हुआ 💔' : 'Sad To See You Go 💔'}
                            </Text>

                            <Text style={styles.modalSubtext}>
                                {isHi
                                    ? 'क्या आप वाकई अपना खाता हटाना चाहते हैं? आप निम्नलिखित लाभ और जानकारी खो देंगे:'
                                    : 'You will lose your order history and refund details. Would you still like to proceed?'}
                            </Text>

                            {/* Bullet Warnings Card */}
                            <View style={styles.warningListCard}>
                                <View style={styles.warningItemRow}>
                                    <View style={styles.warningItemIconBox}>
                                        <ShoppingBag01Icon size={16} color="#DC2626" strokeWidth={2} />
                                    </View>
                                    <Text style={styles.warningItemText}>
                                        {isHi
                                            ? 'पुराने ऑर्डर का इतिहास और रसीदें'
                                            : 'Past order history and receipt details'}
                                    </Text>
                                </View>

                                <View style={styles.warningDivider} />

                                <View style={styles.warningItemRow}>
                                    <View style={styles.warningItemIconBox}>
                                        <CrownIcon size={16} color="#DC2626" strokeWidth={2} />
                                    </View>
                                    <Text style={styles.warningItemText}>
                                        {isHi
                                            ? 'श्रवण वन की सदस्यता और विशेष ऑफर'
                                            : 'Shravan One membership & exclusive benefits'}
                                    </Text>
                                </View>

                                <View style={styles.warningDivider} />

                                <View style={styles.warningItemRow}>
                                    <View style={styles.warningItemIconBox}>
                                        <Location01Icon size={16} color="#DC2626" strokeWidth={2} />
                                    </View>
                                    <Text style={styles.warningItemText}>
                                        {isHi
                                            ? 'सहेजे गए पते और भुगतान प्राथमिकताएं'
                                            : 'Saved delivery addresses and payment preferences'}
                                    </Text>
                                </View>
                            </View>

                            {/* Action Buttons Row */}
                            <View style={styles.actionBtnRow}>
                                {/* Secondary Cancel Button */}
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    activeOpacity={0.8}
                                    onPress={onClose}
                                    disabled={isDeleting}
                                >
                                    <Text style={styles.cancelBtnText}>
                                        {isHi ? 'नहीं, रहने दें' : 'No, Thank You'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Primary Destructive Delete Button */}
                                <TouchableOpacity
                                    style={styles.deleteConfirmBtn}
                                    activeOpacity={0.88}
                                    onPress={onConfirm}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.deleteConfirmBtnText}>
                                            {isHi ? 'हाँ, खाता हटाएँ' : 'Continue'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

export default DeleteAccountModal;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    bottomSheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 34,
        alignItems: 'center',
        position: 'relative',

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
    },
    handleBar: {
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        marginBottom: 16,
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 18,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleContainer: {
        marginBottom: 16,
        marginTop: 4,
    },
    outerGlowRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEF2F2',
        borderWidth: 6,
        borderColor: '#FFE4E6',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    iconBadge: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.4,
    },
    modalSubtext: {
        fontSize: 13.5,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 18,
        paddingHorizontal: 6,
        fontWeight: '500',
    },
    warningListCard: {
        width: '100%',
        backgroundColor: '#FAF5FF',
        borderWidth: 1,
        borderColor: '#F3E8FF',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 22,
    },
    warningItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
    },
    warningItemIconBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningItemText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#475569',
        flex: 1,
    },
    warningDivider: {
        height: 1,
        backgroundColor: '#E9D5FF',
        marginVertical: 6,
        opacity: 0.6,
    },
    actionBtnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    deleteConfirmBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    deleteConfirmBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
});
