import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { COLORS, SPACING } from '../utils/constants';
import type { Coordinates } from '../types/order';

interface MapViewProps {
  pickup?: Coordinates;
  delivery?: Coordinates;
  currentLocation?: Coordinates | null;
  route?: Coordinates[];
  showRoute?: boolean;
}

const { width } = Dimensions.get('window');

export const MapViewComponent: React.FC<MapViewProps> = ({
  pickup,
  delivery,
  currentLocation,
  route = [],
  showRoute = false,
}) => {
  const markers = [];

  if (pickup) {
    markers.push(
      <Marker
        key="pickup"
        coordinate={pickup}
        title="Pickup"
        description="Pickup location"
        pinColor={COLORS.success}
      />
    );
  }

  if (delivery) {
    markers.push(
      <Marker
        key="delivery"
        coordinate={delivery}
        title="Delivery"
        description="Delivery location"
        pinColor={COLORS.primary}
      />
    );
  }

  if (currentLocation) {
    markers.push(
      <Marker
        key="current"
        coordinate={currentLocation}
        title="You"
        description="Your current location"
        pinColor={COLORS.secondary}
      />
    );
  }

  const initialRegion = pickup || delivery || currentLocation
    ? {
        latitude: (pickup || delivery || currentLocation)!.latitude,
        longitude: (pickup || delivery || currentLocation)!.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 28.6139,
        longitude: 77.209,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {markers}
        {showRoute && route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor={COLORS.primary}
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    width: width,
    flex: 1,
  },
});
