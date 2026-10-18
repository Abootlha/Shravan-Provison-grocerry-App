import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Banner, Button, ScreenHeader } from '../components/ui';
import { TextField } from '../components/TextField';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { clearError, sendOtp, verifyOtp } from '../store/slices/authSlice';
import { font, radii, spacing, useTheme } from '../theme';
import { formatPhone } from '../utils/format';
import type { OTPScreenProps } from '../types/navigation';

const DEFAULT_OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

// OTP length from the send-otp response (4-6), else the default.
const normalizeOtpLength = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 4 && n <= 6 ? n : DEFAULT_OTP_LENGTH;
};

/** Phone OTP login for riders whose account (and phone) an admin created. */
export const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { colors: c } = useTheme();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [step, setStep] = useState<'phone' | 'code'>(route.params?.phone ? 'code' : 'phone');
  const [otpLength, setOtpLength] = useState(normalizeOtpLength(route.params?.otpLength));
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const codeRef = useRef<TextInput>(null);
  const verifying = useRef(false);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (step !== 'code') return undefined;
    const interval = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [step]);

  const digits = phone.replace(/\D/g, '');
  const phoneValid = /^[6-9]\d{9}$/.test(digits);

  const requestCode = async () => {
    setPhoneTouched(true);
    if (!phoneValid) return;
    const result = await dispatch(sendOtp(digits));
    if (sendOtp.fulfilled.match(result)) {
      setOtpLength(normalizeOtpLength(result.payload?.otpLength));
      setCode('');
      setTimer(RESEND_SECONDS);
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  };

  const verify = async (value: string) => {
    if (verifying.current || value.length !== otpLength) return;
    verifying.current = true;
    const result = await dispatch(verifyOtp({ phone: digits, otp: value }));
    verifying.current = false;
    if (verifyOtp.fulfilled.match(result)) {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } else {
      setCode('');
      codeRef.current?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title={step === 'phone' ? 'Log in with OTP' : 'Enter OTP'}
        onBack={() => {
          dispatch(clearError());
          if (step === 'code') setStep('phone');
          else navigation.goBack();
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'phone' ? (
          <>
            <AppText variant="body" tone="muted">
              Enter the mobile number registered on your rider account. We will send you a one-time code.
            </AppText>
            <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
              <TextField
                label="Mobile number"
                prefix="+91"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="98765 43210"
                maxLength={10}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={requestCode}
                error={phoneTouched && !phoneValid ? 'Enter a valid 10-digit mobile number' : null}
              />
              {error ? <Banner tone="danger" title={error} /> : null}
              <Button label="Send OTP" onPress={requestCode} loading={loading} />
            </View>
          </>
        ) : (
          <>
            <AppText variant="body" tone="muted">
              Code sent to <AppText weight="bold">{formatPhone(digits)}</AppText>
            </AppText>
            <Pressable onPress={() => codeRef.current?.focus()} style={styles.boxes} accessibilityLabel="OTP code">
              {Array.from({ length: otpLength }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.box,
                    {
                      borderColor: error ? c.danger : index === code.length ? c.brand : c.borderStrong,
                      backgroundColor: code[index] ? c.brandSoft : c.surface,
                    },
                  ]}
                >
                  <AppText variant="h1" numeric>
                    {code[index] ?? ''}
                  </AppText>
                </View>
              ))}
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(v) => {
                  const next = v.replace(/\D/g, '').slice(0, otpLength);
                  setCode(next);
                  if (error) dispatch(clearError());
                  if (next.length === otpLength) verify(next);
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={otpLength}
                autoFocus
                caretHidden
                style={[styles.hidden, font('regular')]}
                accessibilityLabel="OTP input"
              />
            </Pressable>
            {error ? <Banner tone="danger" title={error} style={{ marginTop: spacing.lg }} /> : null}
            <Button
              label="Verify and log in"
              onPress={() => verify(code)}
              loading={loading}
              disabled={code.length !== otpLength}
              style={{ marginTop: spacing.xl }}
            />
            <View style={styles.resend}>
              {timer > 0 ? (
                <AppText variant="bodySm" tone="muted" numeric>
                  Resend code in 0:{String(timer).padStart(2, '0')}
                </AppText>
              ) : (
                <Button
                  label="Resend code"
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  onPress={requestCode}
                  disabled={loading}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.xl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  boxes: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, justifyContent: 'center' },
  box: {
    width: 58,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  resend: { alignItems: 'center', marginTop: spacing.lg, minHeight: 46, justifyContent: 'center' },
});
