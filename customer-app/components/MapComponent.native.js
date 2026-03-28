import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { reverseGeocode, formatAddress } from '../services/locationService';
import { openInMapMyIndia } from '../services/mapService';

const MapComponent = ({
    selectedLocation,
    addressDetails,
    isLoading,
    onCurrentLocationPress
}) => {

    const handleOpenInMaps = async () => {
        if (!selectedLocation) return;

        try {
            const lat = selectedLocation.latitude;
            const lng = selectedLocation.longitude;
            const url = `https://maps.mapmyindia.com/explore/#/place?q=${lat},${lng}&zoom=17&center=${lng},${lat}`;
            await Linking.openURL(url);
        } catch (error) {
            console.error('Error opening maps:', error);
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.mapPlaceholder}>
                <View style={styles.mapBackground}>
                    <View style={styles.gridLine1} />
                    <View style={styles.gridLine2} />
                    <View style={styles.gridLine3} />
                    <View style={styles.gridLine4} />
                </View>
                <View style={styles.pinContainer}>
                    <MaterialCommunityIcons name="map-marker" size={50} color="#E91E63" />
                    <View style={styles.pinShadow} />
                </View>

                {selectedLocation && (
                    <TouchableOpacity
                        style={styles.openMapButton}
                        onPress={handleOpenInMaps}
                    >
                        <MaterialCommunityIcons name="open-in-new" size={16} color="#E91E63" />
                        <Text style={styles.openMapText}>Open in MapMyIndia</Text>
                    </TouchableOpacity>
                )}
            </View>

            {selectedLocation ? (
                <View style={styles.locationCard}>
                    <View style={styles.locationIconContainer}>
                        <MaterialCommunityIcons name="map-marker-check" size={24} color="#E91E63" />
                    </View>
                    <View style={styles.locationDetails}>
                        <Text style={styles.locationTitle}>
                            {addressDetails?.formattedAddress || addressDetails?.address || 'Location Selected'}
                        </Text>
                        {addressDetails?.city && (
                            <Text style={styles.locationSubtitle}>
                                {[addressDetails.city, addressDetails.pincode].filter(Boolean).join(', ')}
                            </Text>
                        )}
                        <Text style={styles.locationCoords}>
                            {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.noLocationCard}>
                    <MaterialCommunityIcons name="map-marker-question" size={32} color={COLORS.textSecondary} />
                    <Text style={styles.noLocationText}>No location selected</Text>
                    <Text style={styles.noLocationHint}>
                        Use the button below to detect your current location
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.gpsButton}
                onPress={onCurrentLocationPress}
                disabled={isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#E91E63" />
                ) : (
                    <>
                        <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#E91E63" />
                        <Text style={styles.gpsButtonText}>Use Current Location</Text>
                    </>
                )}
            </TouchableOpacity>

            {isLoading && (
                <Text style={styles.loadingText}>Detecting your location...</Text>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    mapPlaceholder: {
        height: 200,
        backgroundColor: '#E8F5E9',
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.3,
    },
    gridLine1: {
        position: 'absolute',
        top: '30%',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#81C784',
    },
    gridLine2: {
        position: 'absolute',
        top: '60%',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#81C784',
    },
    gridLine3: {
        position: 'absolute',
        left: '30%',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#81C784',
    },
    gridLine4: {
        position: 'absolute',
        left: '70%',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: '#81C784',
    },
    pinContainer: {
        alignItems: 'center',
    },
    pinShadow: {
        width: 20,
        height: 8,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        marginTop: -5,
    },
    openMapButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    openMapText: {
        fontSize: 11,
        color: '#E91E63',
        fontWeight: '600',
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        margin: 16,
        marginTop: 0,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCE4EC',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    locationIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FCE4EC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationDetails: {
        flex: 1,
        marginLeft: 12,
    },
    locationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    locationSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    locationCoords: {
        fontSize: 11,
        color: '#999',
        marginTop: 6,
    },
    noLocationCard: {
        alignItems: 'center',
        margin: 16,
        marginTop: 0,
        padding: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    noLocationText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
        marginTop: 12,
    },
    noLocationHint: {
        fontSize: 13,
        color: '#999',
        marginTop: 4,
        textAlign: 'center',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 16,
        padding: 16,
        backgroundColor: '#FCE4EC',
        borderRadius: 12,
        gap: 10,
    },
    gpsButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E91E63',
    },
    loadingText: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
    },
});

export default MapComponent;
