import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    Modal,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ArrowLeft01Icon,
    Camera01Icon,
    UserIcon,
    Mail01Icon,
    CallIcon,
    SquareLock01Icon,
    Delete01Icon,
    CheckmarkCircle01Icon,
    Alert01Icon,
} from 'hugeicons-react-native';
import { updateUser, logout } from '../store/slices/authSlice';
import { CommonActions } from '@react-navigation/native';
import { useTranslation } from '../hooks/useTranslation';
import { AuthService, UserService } from '../services';
import { DeleteAccountModal } from '../components';

const ProfileSettingsScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();

    const { user } = useSelector((state) => state.auth);

    // State variables for form fields
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone] = useState(user?.phone || user?.mobile || user?.phoneNumber || '');
    const [profilePicture, setProfilePicture] = useState(
        user?.profilePicture || user?.avatar || user?.photo || null
    );

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Fetch latest profile from MongoDB on screen mount without overwriting active edits
    React.useEffect(() => {
        let isMounted = true;
        const fetchLatestProfile = async () => {
            try {
                const profile = await UserService.getProfile();
                if (profile && isMounted) {
                    if (profile.name) {
                        setName(prev => (prev === (user?.name || '') || !prev ? profile.name : prev));
                    }
                    if (profile.email) {
                        setEmail(prev => (prev === (user?.email || '') || !prev ? profile.email : prev));
                    }
                    if (profile.profilePicture) setProfilePicture(profile.profilePicture);
                    dispatch(updateUser({ ...user, ...profile }));
                }
            } catch (err) {
                if (__DEV__) console.log('Error fetching latest profile:', err);
            }
        };
        fetchLatestProfile();
        return () => { isMounted = false; };
    }, []);

    // Pick profile picture from device gallery
    const handlePickImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert(
                    isHi ? 'अनुमति की आवश्यकता है' : 'Permission Required',
                    isHi
                        ? 'कृपया प्रोफाइल फोटो चुनने के लिए गैलरी एक्सेस की अनुमति दें।'
                        : 'Please allow access to your media library to choose a profile photo.'
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setProfilePicture(result.assets[0].uri);
            }
        } catch (error) {
            console.log('Error picking image:', error);
            Alert.alert(
                isHi ? 'त्रुटि' : 'Error',
                isHi ? 'फोटो चुनने में विफल।' : 'Failed to select image.'
            );
        }
    };

    // Save profile changes
    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert(
                isHi ? 'आवश्यक फ़ील्ड' : 'Required Field',
                isHi ? 'कृपया अपना नाम दर्ज करें।' : 'Please enter your name.'
            );
            return;
        }

        setIsSaving(true);
        try {
            const updatedUserData = {
                ...user,
                name: trimmedName,
                email: email.trim(),
                profilePicture: profilePicture,
                avatar: profilePicture,
            };

            // 1. Update Redux state & local storage immediately
            dispatch(updateUser(updatedUserData));
            await AsyncStorage.setItem('customerUser', JSON.stringify(updatedUserData));

            // 2. Persist to MongoDB backend
            try {
                const res = await UserService.updateProfile({
                    name: trimmedName,
                    email: email.trim(),
                    profilePicture: profilePicture,
                });
                if (res) {
                    dispatch(updateUser({ ...updatedUserData, ...res }));
                    await AsyncStorage.setItem('customerUser', JSON.stringify({ ...updatedUserData, ...res }));
                }
            } catch (apiErr) {
                if (__DEV__) console.log('Backend profile save error:', apiErr?.response?.data || apiErr?.message);
            }

            setIsSaving(false);
            setShowToast(true);

            setTimeout(() => {
                setShowToast(false);
                if (navigation.canGoBack()) {
                    navigation.goBack();
                }
            }, 1000);
        } catch (error) {
            if (__DEV__) console.log('Error updating profile:', error);
            setIsSaving(false);
            Alert.alert(
                isHi ? 'त्रुटि' : 'Error',
                isHi ? 'प्रोफ़ाइल अपडेट करने में विफल।' : 'Failed to update profile.'
            );
        }
    };

    // Confirm & Delete Account
    const handleConfirmDelete = async () => {
        setShowDeleteModal(false);
        setIsDeleting(true);

        try {
            // Attempt API call if available
            try {
                // Calls /auth/logout, then clears stored tokens even if the call fails.
                await AuthService.logout();
            } catch (err) {
                if (__DEV__) console.log('Logout on delete error:', err.message);
            }

            await AsyncStorage.removeItem('customerCart');

            dispatch(logout());
            setIsDeleting(false);

            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                })
            );
        } catch (error) {
            if (__DEV__) console.log('Error deleting account:', error);
            setIsDeleting(false);
            Alert.alert(
                isHi ? 'त्रुटि' : 'Error',
                isHi ? 'खाता हटाने में समस्या आई।' : 'Failed to delete account.'
            );
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3E8FF" />

            {/* STICKY TOP HEADER */}
            <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 10) }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                        activeOpacity={0.75}
                    >
                        <ArrowLeft01Icon size={20} color="#1E1B4B" strokeWidth={2.2} />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        {isHi ? 'प्रोफ़ाइल सेटिंग्स' : 'Profile Settings'}
                    </Text>

                    <View style={{ width: 38 }} />
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110 }}
            >
                <View style={styles.mainContentSheet}>
                    {/* 1. PROFILE AVATAR SECTION */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity
                            style={styles.avatarContainer}
                            activeOpacity={0.85}
                            onPress={handlePickImage}
                        >
                            {profilePicture ? (
                                <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
                            ) : (
                                <Image
                                    source={require('../assets/default-avatar.png')}
                                    style={styles.avatarImage}
                                />
                            )}

                            {/* Camera Edit Badge */}
                            <View style={styles.cameraBadge}>
                                <Camera01Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
                            <Text style={styles.changePhotoText}>
                                {isHi ? 'फ़ोटो बदलें' : 'Change Profile Photo'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* 2. USER DETAILS FORM */}
                    <View style={styles.formContainer}>
                        {/* NAME INPUT (EDITABLE) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                {isHi ? 'पूरा नाम' : 'Full Name'}
                            </Text>
                            <View style={styles.inputWrapper}>
                                <View style={styles.inputIconBox}>
                                    <UserIcon size={18} color="#6C3CF4" strokeWidth={2} />
                                </View>
                                <TextInput
                                    style={styles.textInput}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder={isHi ? 'अपना नाम दर्ज करें' : 'Enter your full name'}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>

                        {/* PHONE NUMBER (NON-EDITABLE) */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.inputLabel}>
                                    {isHi ? 'मोबाइल नंबर' : 'Mobile Number'}
                                </Text>
                                <Text style={styles.nonEditableBadge}>
                                    {isHi ? 'गैर-संपादन योग्य' : 'Verified'}
                                </Text>
                            </View>
                            <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                                <View style={styles.inputIconBox}>
                                    <CallIcon size={18} color="#9CA3AF" strokeWidth={2} />
                                </View>
                                <TextInput
                                    style={[styles.textInput, styles.disabledTextInput]}
                                    value={phone}
                                    editable={false}
                                    placeholderTextColor="#9CA3AF"
                                />
                                <View style={styles.lockIconBox}>
                                    <SquareLock01Icon size={16} color="#9CA3AF" strokeWidth={2} />
                                </View>
                            </View>
                            <Text style={styles.fieldHelpText}>
                                {isHi
                                    ? 'सुरक्षा कारणों से मोबाइल नंबर बदला नहीं जा सकता।'
                                    : 'Mobile number cannot be edited for account security.'}
                            </Text>
                        </View>

                        {/* EMAIL ADDRESS (EDITABLE) */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>
                                {isHi ? 'ईमेल पता' : 'Email Address'}
                            </Text>
                            <View style={styles.inputWrapper}>
                                <View style={styles.inputIconBox}>
                                    <Mail01Icon size={18} color="#6C3CF4" strokeWidth={2} />
                                </View>
                                <TextInput
                                    style={styles.textInput}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholder={isHi ? 'अपना ईमेल दर्ज करें' : 'Enter your email address'}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                    </View>

                    {/* 3. DANGER ZONE / DELETE ACCOUNT */}
                    <View style={styles.dangerZoneCard}>
                        <View style={styles.dangerHeaderRow}>
                            <Alert01Icon size={18} color="#EF4444" strokeWidth={2} />
                            <Text style={styles.dangerTitle}>
                                {isHi ? 'खाता नियंत्रण' : 'Account Controls'}
                            </Text>
                        </View>
                        <Text style={styles.dangerSubtext}>
                            {isHi
                                ? 'अपना खाता और संबंधित सभी डेटा स्थायी रूप से हटाएं।'
                                : 'Permanently delete your account and all associated order history.'}
                        </Text>

                        <TouchableOpacity
                            style={styles.deleteAccountBtn}
                            activeOpacity={0.8}
                            onPress={() => setShowDeleteModal(true)}
                        >
                            <Delete01Icon size={18} color="#EF4444" strokeWidth={2} />
                            <Text style={styles.deleteAccountText}>
                                {isHi ? 'खाता हटाएं (Delete Account)' : 'Delete Account'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* 4. BOTTOM FLOATING SAVE BUTTON */}
            <View style={[styles.bottomBarContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                    style={styles.saveBtn}
                    activeOpacity={0.9}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.saveBtnText}>
                            {isHi ? 'बदलाव सहेजें' : 'Save Changes'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* DELETE CONFIRMATION MODAL */}
            <DeleteAccountModal
                visible={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
            />

            {/* SUCCESS TOAST */}
            {showToast && (
                <View style={styles.toastContainer}>
                    <CheckmarkCircle01Icon size={20} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.toastText}>
                        {isHi ? 'प्रोफ़ाइल सफलतापूर्वक सहेजी गई!' : 'Profile updated successfully!'}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default ProfileSettingsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3E8FF',
    },
    stickyHeader: {
        backgroundColor: '#F3E8FF',
        zIndex: 100,
        paddingBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E1B4B',
        letterSpacing: -0.3,
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#F3E8FF',
    },
    mainContentSheet: {
        backgroundColor: '#FAF7FD',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingTop: 24,
        paddingHorizontal: 18,
        minHeight: 750,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },

    /* AVATAR SECTION */
    avatarSection: {
        alignItems: 'center',
        marginBottom: 26,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 10,
    },
    avatarImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#F3E8FF',
        borderWidth: 3,
        borderColor: '#E9D5FF',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#6C3CF4',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    changePhotoText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6C3CF4',
    },

    /* FORM STYLES */
    formContainer: {
        gap: 18,
        marginBottom: 24,
    },
    inputGroup: {
        gap: 6,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    nonEditableBadge: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 52,
    },
    disabledInputWrapper: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
    },
    inputIconBox: {
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    disabledTextInput: {
        color: '#6B7280',
    },
    lockIconBox: {
        marginLeft: 8,
    },
    fieldHelpText: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
        paddingLeft: 2,
    },

    /* DANGER ZONE */
    dangerZoneCard: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
        borderRadius: 16,
        padding: 16,
        marginTop: 10,
        marginBottom: 20,
    },
    dangerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    dangerTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#991B1B',
    },
    dangerSubtext: {
        fontSize: 12,
        color: '#7F1D1D',
        lineHeight: 18,
        marginBottom: 14,
    },
    deleteAccountBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FCA5A5',
        borderRadius: 12,
        paddingVertical: 12,
        gap: 8,
    },
    deleteAccountText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },

    /* BOTTOM BAR & BUTTON */
    bottomBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: 'rgba(108, 60, 244, 0.08)',
        paddingHorizontal: 18,
        paddingTop: 12,

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 8,
    },
    saveBtn: {
        backgroundColor: '#6C3CF4',
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },

    /* MODAL STYLES */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    modalWarningIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E1B4B',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalBody: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4B5563',
    },
    modalConfirmDeleteBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalConfirmDeleteText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    /* TOAST */
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: '#10B981',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        zIndex: 200,

        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    toastText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
