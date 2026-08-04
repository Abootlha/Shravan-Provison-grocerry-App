import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

const DEFAULT_REGION = {
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
};

const MapComponent = ({
    region,
    selectedLocation,
    addressDetails,
    isLoading,
    onMapPress,
    onRegionChangeComplete,
    onCurrentLocationPress,
}) => {
    const activeRegion = region || {
        ...DEFAULT_REGION,
        ...(selectedLocation
            ? {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
            }
            : {}),
    };

    return (
        <View style={styles.container}>
            <View style={styles.mapShell}>
                <MapView
                    style={styles.map}
                    initialRegion={activeRegion}
                    region={activeRegion}
                    onPress={onMapPress}
                    onRegionChangeComplete={onRegionChangeComplete}
                    showsUserLocation
                    showsMyLocationButton={false}
                >
                    {selectedLocation && (
                        <Marker
                            coordinate={{
                                latitude: selectedLocation.latitude,
                                longitude: selectedLocation.longitude,
                            }}
                            title={addressDetails?.address || 'Selected Location'}
                            description={[addressDetails?.city, addressDetails?.pincode].filter(Boolean).join(', ')}
                        />
                    )}
                </MapView>



                <TouchableOpacity
                    style={styles.gpsFloatingButton}
                    onPress={onCurrentLocationPress}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color={COLORS.white} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    mapShell: {
        flex: 1,
        minHeight: 320,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 18,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#EDEDED',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    gpsFloatingButton: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E91E63',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 8,
    },
    topFloatingCard: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 20,
    },
    topFloatingBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    topFloatingTextGroup: {
        flex: 1,
    },
    topFloatingTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#111827',
    },
    topFloatingSubtext: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 1,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FCE4EC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
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
        marginHorizontal: 16,
        marginBottom: 16,
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
});

export default MapComponent;
