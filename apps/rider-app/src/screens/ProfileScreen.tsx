import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../utils/constants';
import { useAppDispatch, useAppSelector } from '../hooks/useAuth';
import { setUser } from '../store/slices/authSlice';
import { logout } from '../store/slices/authSlice';
import type { ProfileScreenProps } from '../types/navigation';
import type { Rider } from '../types/rider';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [editing, setEditing] = useState(false);

  const handleSave = useCallback(() => {
    if (name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters');
      return;
    }

    dispatch(setUser({ ...(user as Rider), name: name.trim() }));
    setEditing(false);
    Alert.alert('Success', 'Profile updated successfully');
  }, [dispatch, user, name]);

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          dispatch(logout());
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  }, [dispatch, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(user?.name || 'R').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.name || 'Rider'}</Text>
          <Text style={styles.phone}>{user?.phone || ''}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={styles.rating}>{user?.rating?.toFixed(1) || '0.0'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text style={styles.editButton}>{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.disabled}
                />
              ) : (
                <Text style={styles.fieldValue}>{user?.name || '-'}</Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <Text style={styles.fieldValue}>{user?.phone || '-'}</Text>
            </View>
            <View style={[styles.field, styles.fieldLast]}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{user?.email || '-'}</Text>
            </View>
          </View>
          {editing && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Vehicle Type</Text>
              <Text style={styles.fieldValue}>
                {user?.vehicle?.type
                  ? user.vehicle.type.charAt(0).toUpperCase() + user.vehicle.type.slice(1)
                  : '-'}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Vehicle Number</Text>
              <Text style={styles.fieldValue}>{user?.vehicle?.number || '-'}</Text>
            </View>
            <View style={[styles.field, styles.fieldLast]}>
              <Text style={styles.fieldLabel}>Vehicle Make/Model</Text>
              <Text style={styles.fieldValue}>
                {user?.vehicle?.make && user?.vehicle?.model
                  ? `${user.vehicle.make} ${user.vehicle.model}`
                  : '-'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Aadhar Card</Text>
              <Text style={styles.fieldValue}>
                {user?.documents?.aadhar ? 'Uploaded' : 'Not Uploaded'}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Driving License</Text>
              <Text style={styles.fieldValue}>
                {user?.documents?.drivingLicense ? 'Uploaded' : 'Not Uploaded'}
              </Text>
            </View>
            <View style={[styles.field, styles.fieldLast]}>
              <Text style={styles.fieldLabel}>RC Book</Text>
              <Text style={styles.fieldValue}>
                {user?.documents?.rcBook ? 'Uploaded' : 'Not Uploaded'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>Upload Documents</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Total Deliveries</Text>
              <Text style={styles.fieldValue}>{user?.totalDeliveries || 0}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Acceptance Rate</Text>
              <Text style={styles.fieldValue}>{user?.acceptanceRate || 0}%</Text>
            </View>
            <View style={[styles.field, styles.fieldLast]}>
              <Text style={styles.fieldLabel}>Member Since</Text>
              <Text style={styles.fieldValue}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : '-'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  avatarContainer: {
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.surface,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  rating: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.warning,
  },
  section: {
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  editButton: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fieldValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  input: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: SPACING.sm,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveButtonText: {
    color: COLORS.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: COLORS.primary + '20',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: COLORS.error + '20',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
