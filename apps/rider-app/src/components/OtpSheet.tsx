import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Sheet } from './Sheet';
import { SlideToConfirm } from './SlideToConfirm';
import { AppText, Banner, Button } from './ui';
import { PaymentCallout } from './order';
import { font, radii, spacing, useTheme } from '../theme';
import type { Order } from '../types/order';
import { callPhone } from '../utils/format';

const LENGTH = 4;

type Props = {
  visible: boolean;
  order: Order;
  onClose: () => void;
  /** Resolve to an error message (wrong code, locked) or null on success. */
  onSubmit: (otp: string) => Promise<string | null>;
};

/** Delivery code entry. The server checks the code and allows 5 attempts. */
export const OtpSheet: React.FC<Props> = ({ visible, order, onClose, onSubmit }) => {
  const { colors: c } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
    }
  }, [visible]);

  const locked = Boolean(error && /too many/i.test(error));
  const complete = code.length === LENGTH;

  const submit = async () => {
    if (!complete || locked) return false;
    setBusy(true);
    const message = await onSubmit(code);
    setBusy(false);
    if (message) {
      setError(message);
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
      return false;
    }
    return true;
  };

  const customerPhone = order.delivery.receiverPhone || order.delivery.phone;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={!busy}
      title="Enter delivery code"
      subtitle={`Ask ${order.delivery.receiverName || order.delivery.name} for the 4-digit code shown in their app.`}
    >
      <PaymentCallout order={order} style={{ marginBottom: spacing.lg }} />

      <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Delivery code" style={styles.boxes}>
        {Array.from({ length: LENGTH }).map((_, index) => {
          const filled = index < code.length;
          const focused = index === code.length && !locked;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor: error ? c.danger : focused ? c.brand : c.borderStrong,
                  backgroundColor: filled ? c.brandSoft : c.surface,
                },
              ]}
            >
              <AppText variant="display" numeric>
                {code[index] ?? ''}
              </AppText>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, '').slice(0, LENGTH));
            if (error && !locked) setError(null);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus
          editable={!locked && !busy}
          caretHidden
          style={[styles.hiddenInput, font('regular')]}
          accessibilityLabel="Delivery code input"
        />
      </Pressable>

      {error ? (
        <Banner
          tone="danger"
          title={locked ? 'Code locked' : 'Wrong code'}
          message={locked ? `${error} Call the store to complete this delivery.` : error}
          style={{ marginTop: spacing.lg }}
        />
      ) : (
        <AppText variant="bodySm" tone="muted" align="center" style={{ marginTop: spacing.md }}>
          The code is checked by the server. You have 5 attempts.
        </AppText>
      )}

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {locked ? (
          <Button label="Call store" icon="phone" onPress={() => callPhone(order.pickup.phone, 'the store')} />
        ) : (
          <SlideToConfirm
            label={complete ? 'Slide to complete delivery' : 'Enter the 4-digit code'}
            tone="success"
            disabled={!complete || busy}
            onConfirm={submit}
            testID="slide-deliver"
          />
        )}
        <Button
          label="Call customer"
          icon="phone"
          variant="ghost"
          size="md"
          onPress={() => callPhone(customerPhone, 'the customer')}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  box: {
    width: 64,
    height: 72,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
});
