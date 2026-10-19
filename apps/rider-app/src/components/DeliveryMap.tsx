import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import type { Coordinates } from '../types/order';
import type { LiveLocation } from '../types/rider';
import type { RouteLine } from '../hooks/useRouteLine';

export type DeliveryMapHandle = { fitAll: () => void; recenter: () => void };

type Props = {
  store: Coordinates | null;
  customer: Coordinates | null;
  rider: LiveLocation | null;
  route: RouteLine | null;
  /** Which marker is the current destination (highlighted). */
  leg: 'store' | 'customer';
  follow: boolean;
  /** The rider dragged the map: the screen turns follow mode off. */
  onUserPan: () => void;
  /** Space covered by the bottom sheet, so fitted content stays visible. */
  bottomInset: number;
};

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d1c22' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a97a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1c22' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2e2c37' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#403d4b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a2b' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#24222b' }] },
];

const PinMarker: React.FC<{ icon: 'storefront' | 'home'; color: string; active: boolean }> = ({
  icon,
  color,
  active,
}) => (
  <View style={{ alignItems: 'center' }}>
    <View
      style={[
        styles.pin,
        { backgroundColor: color, transform: [{ scale: active ? 1.12 : 0.92 }], opacity: active ? 1 : 0.85 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" />
    </View>
    <View style={[styles.pinTip, { borderTopColor: color }]} />
  </View>
);

export const DeliveryMap = forwardRef<DeliveryMapHandle, Props>(
  ({ store, customer, rider, route, leg, follow, onUserPan, bottomInset }, ref) => {
    const theme = useTheme();
    const c = theme.colors;
    const mapRef = useRef<MapView>(null);
    const riderCoords = rider ? { latitude: rider.latitude, longitude: rider.longitude } : null;
    const destination = leg === 'store' ? store : customer;

    const padding = useMemo(() => ({ top: 140, right: 60, bottom: bottomInset + 40, left: 60 }), [bottomInset]);

    const fitAll = () => {
      const points = [riderCoords, destination, leg === 'store' ? customer : null].filter(Boolean) as Coordinates[];
      if (points.length >= 2) {
        mapRef.current?.fitToCoordinates(points, { edgePadding: padding, animated: true });
      } else if (points[0]) {
        mapRef.current?.animateCamera({ center: points[0], zoom: 16 }, { duration: 400 });
      }
    };

    const recenter = () => {
      if (!riderCoords) {
        fitAll();
        return;
      }
      const heading = rider?.heading != null && rider.heading >= 0 ? rider.heading : 0;
      mapRef.current?.animateCamera({ center: riderCoords, zoom: 17, heading, pitch: 35 }, { duration: 500 });
    };

    useImperativeHandle(ref, () => ({ fitAll, recenter }));

    // Follow mode: keep the camera on the rider as fixes arrive.
    useEffect(() => {
      if (follow && riderCoords) recenter();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [follow, rider?.latitude, rider?.longitude, rider?.heading]);

    const initial = riderCoords || destination || store || customer;

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={theme.dark ? DARK_STYLE : undefined}
        initialRegion={
          initial
            ? { ...initial, latitudeDelta: 0.02, longitudeDelta: 0.02 }
            : { latitude: 22.5, longitude: 79, latitudeDelta: 20, longitudeDelta: 20 }
        }
        mapPadding={{ top: 0, right: 0, bottom: bottomInset - 20, left: 0 }}
        showsCompass={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        toolbarEnabled={false}
        onPanDrag={onUserPan}
        onMapReady={() => setTimeout(fitAll, 300)}
      >
        {route && route.points.length > 1 ? (
          <Polyline
            coordinates={route.points}
            strokeColor={c.mapRoute}
            strokeWidth={route.kind === 'road' ? 6 : 4}
            lineDashPattern={route.kind === 'straight' ? [12, 10] : undefined}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {store ? (
          <Marker coordinate={store} anchor={{ x: 0.5, y: 1 }} title="Store">
            <PinMarker icon="storefront" color={theme.dark ? '#5D5A68' : '#16141D'} active={leg === 'store'} />
          </Marker>
        ) : null}
        {customer ? (
          <Marker coordinate={customer} anchor={{ x: 0.5, y: 1 }} title="Customer">
            <PinMarker icon="home" color={c.success} active={leg === 'customer'} />
          </Marker>
        ) : null}
        {riderCoords ? (
          <Marker
            coordinate={riderCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={rider?.heading != null && rider.heading >= 0 ? rider.heading : 0}
            title="You"
          >
            <View style={[styles.rider, { backgroundColor: c.brand }]}>
              <MaterialCommunityIcons name="navigation" size={22} color="#FFFFFF" />
            </View>
          </Marker>
        ) : null}
      </MapView>
    );
  }
);

DeliveryMap.displayName = 'DeliveryMap';

const styles = StyleSheet.create({
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  rider: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
