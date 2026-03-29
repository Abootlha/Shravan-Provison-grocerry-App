import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { getMapmyIndiaMapUrl } from '../services/mapService';

const DEFAULT_CENTER = {
    latitude: 28.6139,
    longitude: 77.2090,
};

const iframeBaseStyle = {
    border: 0,
    width: '100%',
    height: '100%',
};

const MapComponent = ({
    region,
    selectedLocation,
    addressDetails,
    isLoading,
    onCurrentLocationPress,
}) => {
    const center = selectedLocation || region || DEFAULT_CENTER;
    const mapUrl = getMapmyIndiaMapUrl(
        {
            latitude: center.latitude,
            longitude: center.longitude,
        },
        selectedLocation ? 16 : 13,
        900,
        420
    );

    return (
        <View style={styles.container}>
            <View style={styles.previewShell}>
                {mapUrl ? (
                    <iframe
                        key={`${center.latitude}-${center.longitude}`}
                        src={mapUrl}
                        title="ShravanKirana Delivery Map"
                        style={iframeBaseStyle}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                ) : (
                    <View style={styles.webNotice}>
                        <MaterialCommunityIcons name="map-marker-radius" size={48} color="#E91E63" />
                        <Text style={styles.webNoticeTitle}>Map is preparing</Text>
                        <Text style={styles.webNoticeText}>
                            We are loading the embedded Mappls view for this location.
                        </Text>
                    </View>
                )}

                {selectedLocation && (
                    <View style={styles.selectionPill}>
                        <MaterialCommunityIcons name="map-marker" size={14} color="#E91E63" />
                        <Text style={styles.selectionPillText}>Selected delivery pin</Text>
                    </View>
                )}
            </View>

            {selectedLocation && (
                <View style={styles.webLocationCard}>
                    <MaterialCommunityIcons name="map-marker" size={24} color="#E91E63" />
                    <View style={styles.webLocationDetails}>
                        <Text style={styles.webLocationTitle}>{addressDetails.address || 'Selected Location'}</Text>
                        <Text style={styles.webLocationSubtitle}>
                            {[addressDetails.city, addressDetails.pincode].filter(Boolean).join(', ')}
                        </Text>
                        <Text style={styles.webLocationCoords}>
                            Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
                        </Text>
                    </View>
                </View>
            )}

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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
    },
    previewShell: {
        height: 260,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: '#FFF8FA',
        borderWidth: 1,
        borderColor: '#FCE4EC',
        marginBottom: 16,
        position: 'relative',
    },
    webNotice: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
    selectionPill: {
        position: 'absolute',
        left: 12,
        top: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.94)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#F8BBD9',
    },
    selectionPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E91E63',
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
        marginBottom: 12,
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
