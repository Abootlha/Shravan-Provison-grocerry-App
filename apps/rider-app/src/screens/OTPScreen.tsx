import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../utils/constants';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { verifyOtp, clearError, sendOtp } from '../store/slices/authSlice';
import type { OTPScreenProps } from '../types/navigation';

const DEFAULT_OTP_LENGTH = 4;

// OTP length from the send-otp response (4-6), else the default.
const normalizeOtpLength = (value: unknown): number => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 4 && n <= 6 ? n : DEFAULT_OTP_LENGTH;
};

export const OTPScreen: React.FC<OTPScreenProps> = ({ navigation, route }) => {
  const { phone, name, isNewAccount } = route.params;
  const [otpLength, setOtpLength] = useState(() => normalizeOtpLength(route.params.otpLength));
  const [otp, setOtp] = useState<string[]>(() => Array(otpLength).fill(''));
  const [timer, setTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyInFlightRef = useRef(false);
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (error) {
      dispatch(clearError());
    }
  }, [dispatch, error]);

  // One digit per box. Several digits at once (paste or SMS autofill) fill the
  // boxes from this one onward. The last digit submits.
  const handleChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '');
    const newOtp = [...otp];
    if (digits.length > 1) {
      const start = digits.length >= otpLength ? 0 : index;
      digits
        .slice(0, otpLength - start)
        .split('')
        .forEach((d, i) => {
          newOtp[start + i] = d;
        });
    } else {
      newOtp[index] = digits;
    }
    setOtp(newOtp);

    const code = newOtp.join('');
    if (code.length === otpLength) {
      inputRefs.current[Math.min(index, otpLength - 1)]?.blur();
      handleVerify(code);
      return;
    }
    const next = newOtp.findIndex((d) => !d);
    if (digits && next > index) {
      inputRefs.current[next]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullOtp?: string) => {
    if (verifyInFlightRef.current || loading) {
      return;
    }

    const otpCode = fullOtp || otp.join('');
    if (otpCode.length !== otpLength) {
      Alert.alert('Error', `Please enter a valid ${otpLength}-digit OTP`);
      return;
    }

    verifyInFlightRef.current = true;
    try {
      const result = await dispatch(verifyOtp({ phone, otp: otpCode, name }));
      if (verifyOtp.fulfilled.match(result)) {
        navigation.replace('Home');
      }
    } finally {
      verifyInFlightRef.current = false;
    }
  };

  const handleResend = async () => {
    if (loading) {
      return;
    }
    setTimer(30);
    const result = await dispatch(sendOtp(phone));
    const length = sendOtp.fulfilled.match(result)
      ? normalizeOtpLength(result.payload?.otpLength)
      : otpLength;
    setOtpLength(length);
    setOtp(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            We sent a code to{'\n'}+91 {phone.slice(-10)}
          </Text>
          {isNewAccount && Boolean(name) && (
            <Text style={styles.helperText}>Creating rider account for {name}</Text>
          )}
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[styles.otpInput, error ? styles.otpInputError : null]}
              value={digit}
              onChangeText={(value) => handleChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              // The first box takes the whole code from SMS autofill or paste.
              maxLength={index === 0 ? otpLength : 1}
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'sms-otp' : 'off'}
              accessibilityLabel={`Digit ${index + 1} of ${otpLength}`}
              selectTextOnFocus
            />
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text style={styles.buttonText}>{isNewAccount ? 'Verify & Create Account' : 'Verify'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.resendText}>Resend in {timer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  helperText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  otpInput: {
    width: 44,
    height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  otpInputError: {
    borderColor: COLORS.error,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  resendContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
