import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Text } from '../../components/ui';
import { space } from '../../constants/theme';
import { makeStyles } from '../../theme';

/**
 * Native PayU checkout. Completion is detected from the backend return URL
 * (onPayuReturn) and then verified by polling the order — never trusted as-is.
 */
export function PayUWebViewModal({ request, onClose, onShouldStartLoad, onPayuReturn, isHi }) {
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={!!request} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.root, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <IconButton name="close" variant="tinted" accessibilityLabel={isHi ? 'भुगतान बंद करें' : 'Close payment'} onPress={onClose} />
                    <Text variant="title" style={styles.title}>{isHi ? 'सुरक्षित भुगतान' : 'Secure payment'}</Text>
                    <View style={styles.spacer} />
                </View>
                {request ? (
                    <WebView
                        source={{
                            uri: request.url,
                            method: 'POST',
                            body: request.body,
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        }}
                        style={styles.web}
                        javaScriptEnabled
                        domStorageEnabled
                        originWhitelist={['*']}
                        onShouldStartLoadWithRequest={onShouldStartLoad}
                        onNavigationStateChange={(navState) => {
                            onPayuReturn(navState.url);
                        }}
                    />
                ) : null}
            </View>
        </Modal>
    );
}

const useStyles = makeStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.surface },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.colors.hairline,
    },
    title: { flex: 1, textAlign: 'center' },
    spacer: { width: 44 },
    web: { flex: 1 },
}));

export default PayUWebViewModal;
