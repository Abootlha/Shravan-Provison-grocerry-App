import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

const OrderTrackingScreen = ({ navigation }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const progressAnim = new Animated.Value(0);

    const steps = [
        { id: 0, title: 'Order Placed', icon: 'check-circle', time: '12:30 PM' },
        { id: 1, title: 'Order Confirmed', icon: 'store-check', time: '12:31 PM' },
        { id: 2, title: 'Preparing', icon: 'package-variant', time: '12:33 PM' },
        { id: 3, title: 'Out for Delivery', icon: 'bike-fast', time: '' },
        { id: 4, title: 'Delivered', icon: 'home-check', time: '' },
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentStep((prev) => (prev < 3 ? prev + 1 : prev));
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                    <MaterialCommunityIcons name="close" size={24} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Tracking</Text>
                <TouchableOpacity>
                    <MaterialCommunityIcons name="headset" size={24} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            {/* ETA Card */}
            <View style={styles.etaCard}>
                <View style={styles.etaIcon}>
                    <MaterialCommunityIcons name="clock-fast" size={40} color={COLORS.secondary} />
                </View>
                <Text style={styles.etaTitle}>Arriving in</Text>
                <Text style={styles.etaTime}>10-15 mins</Text>
                <Text style={styles.etaSubtitle}>Your order is being prepared</Text>
            </View>

            {/* Progress Steps */}
            <View style={styles.progressSection}>
                {steps.map((step, index) => (
                    <View key={step.id} style={styles.stepItem}>
                        <View style={styles.stepLeft}>
                            <View style={[
                                styles.stepIcon,
                                index <= currentStep ? styles.stepIconActive : styles.stepIconInactive
                            ]}>
                                <MaterialCommunityIcons
                                    name={step.icon}
                                    size={20}
                                    color={index <= currentStep ? COLORS.white : COLORS.textSecondary}
                                />
                            </View>
                            {index < steps.length - 1 && (
                                <View style={[
                                    styles.stepLine,
                                    index < currentStep ? styles.stepLineActive : styles.stepLineInactive
                                ]} />
                            )}
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={[
                                styles.stepTitle,
                                index <= currentStep && styles.stepTitleActive
                            ]}>{step.title}</Text>
                            {step.time ? <Text style={styles.stepTime}>{step.time}</Text> : null}
                        </View>
                    </View>
                ))}
            </View>

            {/* Delivery Partner */}
            <View style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                    <MaterialCommunityIcons name="account" size={30} color={COLORS.white} />
                </View>
                <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>Delivery Partner</Text>
                    <Text style={styles.partnerSubtitle}>Will be assigned shortly</Text>
                </View>
                <TouchableOpacity style={styles.callButton}>
                    <MaterialCommunityIcons name="phone" size={20} color={COLORS.secondary} />
                </TouchableOpacity>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomBar}>
                <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.homeButtonText}>Back to Home</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: 16, paddingVertical: 16 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
    etaCard: { backgroundColor: COLORS.white, margin: 16, padding: 24, borderRadius: 16, alignItems: 'center', ...SHADOWS.medium },
    etaIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    etaTitle: { fontSize: 14, color: COLORS.textSecondary },
    etaTime: { fontSize: 32, fontWeight: '800', color: COLORS.secondary, marginTop: 4 },
    etaSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
    progressSection: { backgroundColor: COLORS.white, marginHorizontal: 16, padding: 20, borderRadius: 16, ...SHADOWS.light },
    stepItem: { flexDirection: 'row', minHeight: 60 },
    stepLeft: { alignItems: 'center', width: 40 },
    stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    stepIconActive: { backgroundColor: COLORS.secondary },
    stepIconInactive: { backgroundColor: COLORS.lightGray },
    stepLine: { flex: 1, width: 3, marginVertical: 4 },
    stepLineActive: { backgroundColor: COLORS.secondary },
    stepLineInactive: { backgroundColor: COLORS.lightGray },
    stepContent: { flex: 1, marginLeft: 12, paddingBottom: 16 },
    stepTitle: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
    stepTitleActive: { color: COLORS.text, fontWeight: '600' },
    stepTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    partnerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 16, ...SHADOWS.light },
    partnerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
    partnerInfo: { flex: 1, marginLeft: 12 },
    partnerName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    partnerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    callButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: COLORS.white, ...SHADOWS.medium },
    homeButton: { backgroundColor: COLORS.secondary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    homeButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});

export default OrderTrackingScreen;
