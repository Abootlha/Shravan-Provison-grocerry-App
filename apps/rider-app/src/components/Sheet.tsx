import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, IconButton } from './ui';
import { radii, spacing, useTheme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Block closing while a request is running. */
  dismissible?: boolean;
  children: React.ReactNode;
};

/** Bottom sheet built on Modal: works the same on Android, iOS and web. */
export const Sheet: React.FC<Props> = ({ visible, title, subtitle, onClose, dismissible = true, children }) => {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissible) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: c.overlay }]}
          onPress={close}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <AppText variant="h2" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {dismissible ? <IconButton icon="close" label="Close" onPress={onClose} size={40} /> : null}
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    marginTop: 'auto',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
});
