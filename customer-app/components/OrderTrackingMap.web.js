import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { snapPointToRoute } from '../services/directionsService';

const DEFAULT_CENTER = [26.7606, 83.3732];
const DEFAULT_ZOOM = 14;
const normalizeHeadingDelta = (delta) => {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
};

const OrderTrackingMap = ({
  riderLocation,
  customerLocation,
  storeLocation,
  routeCoordinates,
  riderHeading,
  orderStatus,
  onMapReady,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const routeLineRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const storeMarkerRef = useRef(null);
  const riderAnimationFrameRef = useRef(null);
  const headingAnimationFrameRef = useRef(null);
  const displayRiderPositionRef = useRef(null);
  const displayHeadingRef = useRef(riderHeading || 0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadMap = async () => {
      if (typeof window === 'undefined' || mapInstanceRef.current) return;

      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        if (!isMounted || mapInstanceRef.current) return;

        const mapContainer = mapRef.current;
        if (!mapContainer) return;

        const map = L.map(mapContainer, {
          zoomControl: false,
          attributionControl: false,
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
        setMapLoaded(true);
        onMapReady?.();

        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      } catch (error) {
        console.warn('Failed to load map:', error);
        onMapReady?.();
      }
    };

    loadMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onMapReady, pulseAnim]);

  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const updateMarkers = async () => {
      try {
        const L = await import('leaflet');
        const map = mapInstanceRef.current;

        const customerIcon = L.divIcon({
          html: `
            <div style="
              width: 36px;
              height: 36px;
              background: ${COLORS.secondary};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          `,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 36],
        });

        const storeIcon = L.divIcon({
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: #FF9800;
              border: 2px solid white;
              border-radius: 8px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
              </svg>
            </div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        if (customerLocation?.latitude && customerLocation?.longitude) {
          L.marker([customerLocation.latitude, customerLocation.longitude], { icon: customerIcon })
            .addTo(map)
            .bindPopup('Delivery Location');
        }

        if (storeLocation?.latitude && storeLocation?.longitude) {
          L.marker([storeLocation.latitude, storeLocation.longitude], { icon: storeIcon })
            .addTo(map)
            .bindPopup('Store Location');
        }

        if (routeCoordinates && routeCoordinates.length > 0) {
          if (routeLineRef.current) {
            map.removeLayer(routeLineRef.current);
          }
          routeLineRef.current = L.polyline(
            routeCoordinates.map(coord => [coord.latitude, coord.longitude]),
            {
              color: COLORS.secondary,
              weight: 4,
              opacity: 0.8,
            }
          ).addTo(map);
        } else if (['PENDING', 'CONFIRMED'].includes(orderStatus) && storeLocation?.latitude && storeLocation?.longitude && customerLocation?.latitude && customerLocation?.longitude) {
          if (routeLineRef.current) {
            map.removeLayer(routeLineRef.current);
          }
          routeLineRef.current = L.polyline(
            [
              [storeLocation.latitude, storeLocation.longitude],
              [customerLocation.latitude, customerLocation.longitude],
            ],
            {
              color: '#9CA3AF',
              weight: 3,
              opacity: 0.8,
              dashArray: '8, 6',
            }
          ).addTo(map);
        }
      } catch (error) {
        console.warn('Failed to update markers:', error);
      }
    };

    updateMarkers();
    const map = mapInstanceRef.current;
    const bounds = [];
    if (customerLocation?.latitude && customerLocation?.longitude) {
      bounds.push([customerLocation.latitude, customerLocation.longitude]);
    }
    if (storeLocation?.latitude && storeLocation?.longitude) {
      bounds.push([storeLocation.latitude, storeLocation.longitude]);
    }
    if (riderLocation?.latitude && riderLocation?.longitude) {
      bounds.push([riderLocation.latitude, riderLocation.longitude]);
    }

    if (bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [mapLoaded, customerLocation, storeLocation, routeCoordinates, riderLocation, orderStatus]);

  useEffect(() => {
    if (!mapLoaded || !riderLocation || !mapInstanceRef.current) return;

    const updateRiderPosition = async () => {
      try {
        const L = await import('leaflet');
        const map = mapInstanceRef.current;

        const riderIcon = L.divIcon({
          html: `
            <div style="
              width: 44px;
              height: 44px;
              background: linear-gradient(135deg, ${COLORS.secondary} 0%, #0C831F 100%);
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
              transform: rotate(${displayHeadingRef.current || 0}deg);
            ">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5c0 1.81 3.95 5 7.5 8.5L21 16l-1.5-1.5C19 11.5 19 6.5 19 6.5zM15.5 8C14.67 8 14 7.33 14 6.5S14.67 5 15.5 5 17 5.67 17 6.5 16.33 8 15.5 8z"/>
                <path d="M12 2L4 10V22h16V10L12 2z" transform="translate(3, -2) scale(0.7)"/>
              </svg>
            </div>
          `,
          className: '',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const snappedLocation = routeCoordinates?.length > 1
          ? snapPointToRoute(riderLocation, routeCoordinates, 90).point
          : riderLocation;

        if (!displayRiderPositionRef.current) {
          displayRiderPositionRef.current = snappedLocation;
        }

        if (!riderMarkerRef.current) {
          riderMarkerRef.current = L.marker(
            [displayRiderPositionRef.current.latitude, displayRiderPositionRef.current.longitude],
            { icon: riderIcon, zIndexOffset: 1000 }
          )
            .addTo(map)
            .bindPopup('Rider Location');
        } else {
          riderMarkerRef.current.setIcon(riderIcon);
        }

        const startPosition = displayRiderPositionRef.current;
        const endPosition = snappedLocation;
        const duration = 900;
        const startedAt = Date.now();

        if (riderAnimationFrameRef.current) {
          cancelAnimationFrame(riderAnimationFrameRef.current);
        }

        const animatePosition = () => {
          const elapsed = Date.now() - startedAt;
          const progress = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const nextPosition = {
            latitude: startPosition.latitude + (endPosition.latitude - startPosition.latitude) * eased,
            longitude: startPosition.longitude + (endPosition.longitude - startPosition.longitude) * eased,
          };
          displayRiderPositionRef.current = nextPosition;
          riderMarkerRef.current?.setLatLng([nextPosition.latitude, nextPosition.longitude]);

          if (progress < 1) {
            riderAnimationFrameRef.current = requestAnimationFrame(animatePosition);
          } else {
            map.panTo([endPosition.latitude, endPosition.longitude], { animate: true });
          }
        };

        riderAnimationFrameRef.current = requestAnimationFrame(animatePosition);
      } catch (error) {
        console.warn('Failed to update rider position:', error);
      }
    };

    updateRiderPosition();
  }, [mapLoaded, riderLocation?.latitude, riderLocation?.longitude, riderHeading, routeCoordinates]);

  useEffect(() => {
    const nextHeading = Number.isFinite(riderHeading) ? riderHeading : 0;
    const startHeading = displayHeadingRef.current || 0;
    const delta = normalizeHeadingDelta(nextHeading - startHeading);
    const duration = 450;
    const startedAt = Date.now();

    if (headingAnimationFrameRef.current) {
      cancelAnimationFrame(headingAnimationFrameRef.current);
    }

    const animateHeading = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      displayHeadingRef.current = ((startHeading + delta * eased) % 360 + 360) % 360;

      if (riderMarkerRef.current) {
        riderMarkerRef.current.setIcon(riderMarkerRef.current.options.icon);
      }

      if (progress < 1) {
        headingAnimationFrameRef.current = requestAnimationFrame(animateHeading);
      }
    };

    headingAnimationFrameRef.current = requestAnimationFrame(animateHeading);

    return () => {
      if (headingAnimationFrameRef.current) {
        cancelAnimationFrame(headingAnimationFrameRef.current);
      }
      if (riderAnimationFrameRef.current) {
        cancelAnimationFrame(riderAnimationFrameRef.current);
      }
    };
  }, [riderHeading]);

  const getStatusText = () => {
    switch (orderStatus) {
      case 'OUT_FOR_DELIVERY':
        return 'Rider is on the way!';
      case 'ASSIGNED':
        return 'Rider assigned, heading to store';
      case 'PACKED':
        return 'Order packed, rider assignment in progress';
      default:
        return 'Live tracking will begin soon';
    }
  };

  if (!mapLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <Animated.View style={[styles.loadingIcon, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons
              name={orderStatus === 'OUT_FOR_DELIVERY' ? 'bike-fast' : 'map-marker-path'}
              size={36}
              color={COLORS.secondary}
            />
          </Animated.View>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View ref={mapRef} style={styles.mapContainer} />

      <View style={styles.overlay}>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, orderStatus === 'OUT_FOR_DELIVERY' && styles.statusDotActive]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {riderLocation && (
        <View style={styles.riderInfo}>
          <MaterialCommunityIcons name="bike-fast" size={18} color={COLORS.secondary} />
          <Text style={styles.riderInfoText}>
            Rider location updated
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E8E8',
  },
  mapContainer: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  statusDotActive: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  riderInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  riderInfoText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
});

export default OrderTrackingMap;
