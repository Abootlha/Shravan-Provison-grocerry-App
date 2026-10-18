import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Banner, Button } from '../components/ui';
import { TextField } from '../components/TextField';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { clearError, clearSessionNotice, login } from '../store/slices/authSlice';
import { radii, spacing, useTheme } from '../theme';
import type { LoginScreenProps } from '../types/navigation';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { loading, error, sessionNotice } = useAppSelector((state) => state.auth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  const usernameError = touched && !username.trim() ? 'Enter your username' : null;
  const passwordError = touched && !password ? 'Enter your password' : null;

  const submit = async () => {
    setTouched(true);
    if (!username.trim() || !password) return;
    dispatch(clearSessionNotice());
    const result = await dispatch(login({ username: username.trim(), password }));
    if (login.fulfilled.match(result)) navigation.replace('Home');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mark, { backgroundColor: c.brand }]}>
          <MaterialCommunityIcons name="moped" size={36} color="#FFFFFF" />
        </View>
        <AppText variant="h1" style={{ marginTop: spacing.xl }}>
          Delivery partner login
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: spacing.xs }}>
          Use the username and password from your store manager.
        </AppText>

        {sessionNotice ? <Banner tone="warning" title={sessionNotice} style={{ marginTop: spacing.xl }} /> : null}

        <View style={{ gap: spacing.lg, marginTop: spacing.xxl }}>
          <TextField
            label="Username"
            icon="account-outline"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. ravi.kumar"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={usernameError}
          />
          <TextField
            ref={passwordRef}
            label="Password"
            icon="lock-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureToggle
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={passwordError}
          />
          {error ? <Banner tone="danger" title={error} /> : null}
          <Button label="Log in" onPress={submit} loading={loading} testID="login-submit" />
        </View>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <AppText variant="caption" tone="subtle">
            OR
          </AppText>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>

        <Button
          label="Log in with phone OTP"
          icon="cellphone-message"
          variant="outline"
          onPress={() => {
            dispatch(clearError());
            navigation.navigate('OTP');
          }}
        />
        <AppText variant="caption" tone="subtle" align="center" style={{ marginTop: spacing.md }}>
          OTP login works for the phone number registered on your rider account.
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, flexGrow: 1, maxWidth: 520, width: '100%', alignSelf: 'center' },
  mark: { width: 64, height: 64, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1 },
});
