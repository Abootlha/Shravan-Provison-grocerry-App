/**
 * ProfileSettingsScreen — edit name, photo and email; phone is locked; delete account lives
 * in a destructive row that opens DeleteAccountModal (a BottomSheet).
 * Motion: "Edit profile" large title collapses into the solid surface bar on scroll; the body rises in once
 * (AnimatedScreen); the save footer rides above the content. Theme: tokens / useTheme() only.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import {
    AnimatedScreen,
    Badge,
    Button,
    Card,
    CollapsibleHeader,
    LargeTitle,
    PressableScale,
    Screen,
    Text,
    toast,
    useCollapsibleHeader,
    useCollapsibleHeaderHeight,
} from '../components/ui';
import { updateUser, logout } from '../store/slices/authSlice';
import { useTranslation } from '../hooks/useTranslation';
import { AuthService, UserService } from '../services';
import { DeleteAccountModal } from '../components';
import { initialsOf } from './orders/orderUtils';
import { FormField } from './profile/FormField';
import { SettingsGroup, SettingsRow } from './profile/SettingsRow';

const ProfileSettingsScreen = ({ navigation }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const collapse = useCollapsibleHeader();
    const top = useCollapsibleHeaderHeight();
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
                toast.error(
                    isHi ? 'अनुमति की आवश्यकता है' : 'Photo access needed',
                    { description: isHi
                        ? 'कृपया प्रोफाइल फोटो चुनने के लिए गैलरी एक्सेस की अनुमति दें।'
                        : 'Please allow access to your media library to choose a profile photo.' }
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
            toast.error(
                isHi ? 'त्रुटि' : 'Error',
                { description: isHi ? 'फोटो चुनने में विफल।' : 'Couldn’t open your photos. Try again.' }
            );
        }
    };

    // Save profile changes
    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error(
                isHi ? 'आवश्यक फ़ील्ड' : 'Name is required',
                { description: isHi ? 'कृपया अपना नाम दर्ज करें।' : 'Please enter your name.' }
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
            toast.success(isHi ? 'प्रोफ़ाइल सहेजी गई' : 'Profile updated');

            setTimeout(() => {
                if (navigation.canGoBack()) {
                    navigation.goBack();
                }
            }, 1000);
        } catch (error) {
            if (__DEV__) console.log('Error updating profile:', error);
            setIsSaving(false);
            toast.error(
                isHi ? 'त्रुटि' : 'Error',
                { description: isHi ? 'प्रोफ़ाइल अपडेट करने में विफल।' : 'Your changes weren’t saved. Check your connection and try again.' }
            );
        }
    };

    // "Delete account" sheet: there is no self-serve delete endpoint, so confirming logs out; the sheet
    // points the user to store support for permanent deletion.
    const handleConfirmDelete = async () => {
        setIsDeleting(true);

        try {
            try {
                // Calls /auth/logout, then clears stored tokens even if the call fails.
                await AuthService.logout();
            } catch (err) {
                if (__DEV__) console.log('Logout on delete error:', err.message);
            }

            await AsyncStorage.removeItem('customerCart');

            dispatch(logout());
            setIsDeleting(false);
            setShowDeleteModal(false);

            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                })
            );
        } catch (error) {
            if (__DEV__) console.log('Error deleting account:', error);
            setIsDeleting(false);
            toast.error(
                isHi ? 'त्रुटि' : 'Error',
                { description: isHi ? 'लॉग आउट नहीं हो पाया। फिर से कोशिश करें।' : 'Couldn’t log you out. Try again.' }
            );
        }
    };

    const initials = initialsOf(name || user?.name || '');
    const screenTitle = isHi ? 'प्रोफ़ाइल बदलें' : 'Edit profile';
    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

    return (
        <Screen edges={[]}>
            <AnimatedScreen>
            <Animated.ScrollView
                onScroll={collapse.onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingTop: top, paddingBottom: 112 + insets.bottom }}
            >
                <LargeTitle collapse={collapse} title={screenTitle} />
                <View style={styles.content}>
                <View style={styles.avatarSection}>
                    <PressableScale
                        onPress={handlePickImage}
                        scaleTo={0.97}
                        style={styles.avatar}
                        accessibilityLabel={isHi ? 'प्रोफ़ाइल फ़ोटो बदलें' : 'Change profile photo'}
                    >
                        {profilePicture ? (
                            <Image source={{ uri: profilePicture }} style={styles.avatarImg} contentFit="cover" transition={150} />
                        ) : (
                            <Text variant="h2" color={colors.brandStrong}>{initials}</Text>
                        )}
                        <View style={styles.cameraBadge}>
                            <MaterialCommunityIcons name="camera-outline" size={16} color={colors.inkSecondary} />
                        </View>
                    </PressableScale>
                    <Button variant="ghost" size="sm" label={isHi ? 'फ़ोटो बदलें' : 'Change photo'} onPress={handlePickImage} style={styles.center} />
                </View>

                <Card padding="lg" style={styles.form}>
                    <FormField
                        label={isHi ? 'पूरा नाम' : 'Full name'}
                        icon="account-outline"
                        value={name}
                        onChangeText={setName}
                        placeholder={isHi ? 'अपना नाम दर्ज करें' : 'Enter your full name'}
                        autoCapitalize="words"
                        textContentType="name"
                    />
                    <FormField
                        label={isHi ? 'मोबाइल नंबर' : 'Mobile number'}
                        icon="phone-outline"
                        value={/^\d{10}$/.test(String(phone)) ? `+91 ${String(phone).slice(0, 5)} ${String(phone).slice(5)}` : phone}
                        editable={false}
                        badge={<Badge tone="success" label={isHi ? 'सत्यापित' : 'Verified'} />}
                        help={isHi ? 'सुरक्षा कारणों से मोबाइल नंबर बदला नहीं जा सकता।' : 'Your number is used to sign in, so it can’t be changed here.'}
                    />
                    <FormField
                        label={isHi ? 'ईमेल पता' : 'Email address'}
                        icon="email-outline"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        textContentType="emailAddress"
                        placeholder={isHi ? 'अपना ईमेल दर्ज करें' : 'name@example.com'}
                    />
                </Card>

                <SettingsGroup title={isHi ? 'खाता नियंत्रण' : 'Account controls'}>
                    <SettingsRow
                        icon="delete-outline"
                        tone="danger"
                        title={isHi ? 'खाता हटाएँ' : 'Delete account'}
                        subtitle={isHi ? 'लॉग आउट करें और सपोर्ट से खाता हटवाएँ' : 'Log out and ask support to delete your data'}
                        loading={isDeleting}
                        onPress={() => setShowDeleteModal(true)}
                    />
                </SettingsGroup>
                </View>
            </Animated.ScrollView>
            </AnimatedScreen>
            <CollapsibleHeader collapse={collapse} title={screenTitle} onBack={goBack} backLabel={isHi ? 'वापस जाएँ' : 'Go back'} />

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
                <Button size="lg" fullWidth label={isHi ? 'बदलाव सहेजें' : 'Save changes'} loading={isSaving} onPress={handleSave} />
            </View>

            <DeleteAccountModal
                visible={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
            />
        </Screen>
    );
};

const AVATAR = 88;

const useStyles = makeStyles((t) => ({
    content: { paddingHorizontal: space.lg, gap: space.xl },
    center: { alignSelf: 'center' },
    avatarSection: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: radii.pill, // circle
        backgroundColor: t.colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImg: { width: AVATAR, height: AVATAR, borderRadius: radii.pill },
    cameraBadge: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 32,
        height: 32,
        borderRadius: radii.pill, // circle
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    form: { gap: space.lg },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        backgroundColor: t.colors.surface,
        borderTopWidth: 1,
        borderTopColor: t.colors.hairline,
        ...t.shadows.floating, // the save bar floats over the scrolling form
    },
}));

export default ProfileSettingsScreen;
