import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Animated,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { setLanguage } from '../store/slices/languageSlice';
import { COLORS } from '../constants';

const { width, height } = Dimensions.get('window');

const LANGUAGES = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        icon: 'alpha-e-circle',
        gradient: ['#667eea', '#764ba2'],
    },
    {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिंदी',
        icon: 'alpha-h-circle',
        gradient: ['#f093fb', '#f5576c'],
    },
];

const LanguageSelectionScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const [scaleAnim] = useState(new Animated.Value(1));

    const handleLanguageSelect = (code) => {
        setSelectedLanguage(code);
        // Animate selection
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 3,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleContinue = () => {
        dispatch(setLanguage(selectedLanguage));
        navigation.replace('Onboarding');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
            
            {/* Background Decoration */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <MaterialCommunityIcons 
                        name="translate" 
                        size={64} 
                        color={COLORS.accent} 
                    />
                    <Text style={styles.title}>
                        {selectedLanguage === 'hi' ? 'अपनी भाषा चुनें' : 'Select Your Language'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {selectedLanguage === 'hi' 
                            ? 'अपनी पसंदीदा भाषा चुनें' 
                            : 'Choose your preferred language'}
                    </Text>
                </View>

                {/* Language Options */}
                <View style={styles.languageContainer}>
                    {LANGUAGES.map((lang, index) => {
                        const isSelected = selectedLanguage === lang.code;
                        return (
                            <TouchableOpacity
                                key={lang.code}
                                style={[
                                    styles.languageCard,
                                    isSelected && styles.languageCardSelected,
                                ]}
                                onPress={() => handleLanguageSelect(lang.code)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.languageCardContent}>
                                    <View style={[
                                        styles.iconWrapper,
                                        { backgroundColor: isSelected ? COLORS.accent + '20' : '#f5f5f5' }
                                    ]}>
                                        <MaterialCommunityIcons
                                            name={lang.icon}
                                            size={48}
                                            color={isSelected ? COLORS.accent : '#666'}
                                        />
                                    </View>
                                    <View style={styles.languageInfo}>
                                        <Text style={[
                                            styles.languageName,
                                            isSelected && styles.languageNameSelected
                                        ]}>
                                            {lang.name}
                                        </Text>
                                        <Text style={[
                                            styles.languageNative,
                                            isSelected && styles.languageNativeSelected
                                        ]}>
                                            {lang.nativeName}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.checkmark}>
                                            <MaterialCommunityIcons
                                                name="check-circle"
                                                size={28}
                                                color={COLORS.accent}
                                            />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Continue Button */}
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.continueButtonText}>
                            {selectedLanguage === 'hi' ? 'जारी रखें' : 'Continue'}
                        </Text>
                        <MaterialCommunityIcons
                            name="arrow-right"
                            size={24}
                            color="#fff"
                        />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    decorCircle1: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: COLORS.primary + '15',
    },
    decorCircle2: {
        position: 'absolute',
        bottom: -80,
        left: -80,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: COLORS.accent + '10',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 40,
        justifyContent: 'space-between',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1a1a1a',
        marginTop: 24,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        fontWeight: '500',
    },
    languageContainer: {
        flex: 1,
        justifyContent: 'center',
        gap: 16,
    },
    languageCard: {
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    languageCardSelected: {
        backgroundColor: '#fff',
        borderColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    languageCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    languageInfo: {
        flex: 1,
    },
    languageName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    languageNameSelected: {
        color: '#1a1a1a',
    },
    languageNative: {
        fontSize: 18,
        color: '#666',
        fontWeight: '500',
    },
    languageNativeSelected: {
        color: COLORS.accent,
    },
    checkmark: {
        marginLeft: 'auto',
    },
    continueButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        gap: 12,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
});

export default LanguageSelectionScreen;
