import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText, Banner, Button, Card, Divider, Row, ScreenHeader, SectionTitle } from '../components/ui';
import { TextField } from '../components/TextField';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { logout, refreshRider, saveProfile } from '../store/slices/authSlice';
import { radii, spacing, TOUCH_TARGET, useTheme } from '../theme';
import { formatPhone } from '../utils/format';
import { VEHICLE_TYPES } from '../types/rider';
import type { ProfileScreenProps } from '../types/navigation';

const VEHICLE_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'Two Wheeler': 'moped',
  'Electric Bike': 'moped-electric',
  Bicycle: 'bicycle',
  'Three Wheeler': 'rickshaw',
  'Four Wheeler': 'car',
};

const VEHICLE_NUMBER = /^[A-Za-z0-9 -]{2,20}$/;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [name, setName] = useState(user?.name ?? '');
  const [vehicleType, setVehicleType] = useState(user?.vehicleType ?? '');
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicleNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    dispatch(refreshRider());
  }, [dispatch]);

  // Pick up server values once they arrive, unless the rider is editing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !user) return;
    setName(user.name ?? '');
    setVehicleType(user.vehicleType ?? '');
    setVehicleNumber(user.vehicleNumber ?? '');
  }, [user, touched]);

  const nameError = !name.trim() ? 'Enter your name' : name.trim().length > 80 ? 'Use at most 80 characters' : null;
  const numberError =
    vehicleNumber.trim() && !VEHICLE_NUMBER.test(vehicleNumber.trim())
      ? 'Use 2–20 letters, digits, spaces or hyphens'
      : null;

  const patch = useMemo(() => {
    const next: { name?: string; vehicleType?: string; vehicleNumber?: string } = {};
    if (name.trim() !== (user?.name ?? '')) next.name = name.trim();
    if (vehicleType && vehicleType !== (user?.vehicleType ?? '')) next.vehicleType = vehicleType;
    if (vehicleNumber.trim().toUpperCase() !== (user?.vehicleNumber ?? '').toUpperCase())
      next.vehicleNumber = vehicleNumber.trim().toUpperCase();
    return next;
  }, [name, vehicleType, vehicleNumber, user]);
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (nameError || numberError || !dirty) return;
    setSaving(true);
    setMessage(null);
    const result = await dispatch(saveProfile(patch));
    setSaving(false);
    if (saveProfile.fulfilled.match(result)) {
      setTouched(false);
      setMessage({ tone: 'success', text: 'Profile saved' });
    } else {
      setMessage({ tone: 'danger', text: result.payload ?? 'Could not save your profile.' });
    }
  };

  const confirmLogout = () => {
    const run = async () => {
      setLoggingOut(true);
      await dispatch(logout());
      setLoggingOut(false);
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert('Log out?', 'You will go offline and stop receiving orders.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: run },
    ]);
  };

  const edit =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setTouched(true);
      setMessage(null);
      setter(value);
    };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Profile" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: c.brand }]}>
            <AppText variant="h1" color="#FFFFFF">
              {(user?.name || 'R').charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" numberOfLines={1}>
              {user?.name || 'Rider'}
            </AppText>
            <AppText variant="bodySm" tone="muted">
              {user?.rating ? `★ ${user.rating.toFixed(1)} · ` : ''}
              {user?.totalDeliveries ?? 0} deliveries
            </AppText>
          </View>
        </Card>

        <View>
          <SectionTitle title="Account" />
          <Card style={{ paddingVertical: spacing.xs }}>
            <Row icon="phone-outline" label="Phone" value={user?.phone ? formatPhone(user.phone) : 'Not set'} />
            <Divider />
            <Row icon="account-outline" label="Username" value={user?.username || 'Not set'} />
          </Card>
          <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.sm }}>
            Phone and username can only be changed by the store admin.
          </AppText>
        </View>

        <View style={{ gap: spacing.lg }}>
          <SectionTitle title="Details" style={{ marginBottom: 0 }} />
          <TextField
            label="Full name"
            value={name}
            onChangeText={edit(setName)}
            error={touched ? nameError : null}
            maxLength={80}
            autoCapitalize="words"
          />
          <View style={{ gap: 6 }}>
            <AppText variant="bodySm" weight="semibold" tone="muted">
              Vehicle type
            </AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {VEHICLE_TYPES.map((type) => {
                const selected = vehicleType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => edit(setVehicleType)(type)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? c.brand : c.border,
                        backgroundColor: selected ? c.brandSoft : c.surface,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={VEHICLE_ICONS[type] ?? 'moped'}
                      size={20}
                      color={selected ? c.brandText : c.textMuted}
                    />
                    <AppText
                      variant="bodySm"
                      weight={selected ? 'bold' : 'medium'}
                      tone={selected ? 'brand' : 'default'}
                    >
                      {type}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <TextField
            label="Vehicle number"
            value={vehicleNumber}
            onChangeText={edit(setVehicleNumber)}
            placeholder="e.g. UP53 AB 1234"
            autoCapitalize="characters"
            maxLength={20}
            error={numberError}
            hint="Leave empty if your vehicle has no number."
          />
          {message ? <Banner tone={message.tone} title={message.text} /> : null}
          <Button
            label="Save changes"
            onPress={save}
            loading={saving}
            disabled={!dirty || Boolean(nameError || numberError)}
          />
        </View>

        <Button label="Log out" icon="logout" variant="outline" onPress={confirmLogout} loading={loggingOut} />
        <AppText variant="caption" tone="subtle" align="center">
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET - 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
});
