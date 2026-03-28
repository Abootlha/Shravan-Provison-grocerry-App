import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

// Web fallback - no map support
const MapComponent = ({
    selectedLocation,
    addressDetails,
    isLoading,
    onCurrentLocationPress
}) => {
    return (
        <ScrollView style={styles.webScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.webNotice}>
                <MaterialCommunityIcons name="map-marker-radius" size={48} color="#E91E63" />
                <Text style={styles.webNoticeTitle}>Map not available on web</Text>
                <Text style={styles.webNoticeText}>
                    Use the search bar above to find your location, or use "Current Location" button.
                </Text>
            </View>

            {/* Search Result / Current Location Display */}
            {selectedLocation && (
                <View style={styles.webLocationCard}>
                    <MaterialCommunityIcons name="map-marker" size={24} color="#E91E63" />
                    <View style={styles.webLocationDetails}>
                        <Text style={styles.webLocationTitle}>{addressDetails.address || 'Selected Location'}</Text>
                        <Text style={styles.webLocationSubtitle}>
                            {addressDetails.city} {addressDetails.pincode}
                        </Text>
                        <Text style={styles.webLocationCoords}>
                            Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
                        </Text>
                    </View>
                </View>
            )}

            {/* GPS Button for Web */}
            <TouchableOpacity style={styles.webGpsButton} onPress={onCurrentLocationPress}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#E91E63" />
                <Text style={styles.webGpsButtonText}>Use Current Location</Text>
            </TouchableOpacity>

            {isLoading && (
                <View style={styles.webLoadingContainer}>
                    <ActivityIndicator size="large" color="#E91E63" />
                    <Text style={styles.webLoadingText}>Getting location...</Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    webScrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    webNotice: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    webNoticeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 12,
    },
    webNoticeText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    webLocationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#FFF8FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCE4EC',
        marginBottom: 16,
    },
    webLocationDetails: {
        flex: 1,
        marginLeft: 12,
    },
    webLocationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    webLocationSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    webLocationCoords: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 4,
    },
    webGpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        backgroundColor: '#FCE4EC',
        borderRadius: 12,
        gap: 8,
    },
    webGpsButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#E91E63',
    },
    webLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    webLoadingText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 12,
    },
});

export default MapComponent;
