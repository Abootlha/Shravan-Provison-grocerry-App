import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline as SvgPolyline } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from './ui';
import { radii, spacing, useTheme } from '../theme';
import type { Coordinates } from '../types/order';
import type { LiveLocation } from '../types/rider';
import type { RouteLine } from '../hooks/useRouteLine';

export type DeliveryMapHandle = { fitAll: () => void; recenter: () => void };

type Props = {
  store: Coordinates | null;
  customer: Coordinates | null;
  rider: LiveLocation | null;
  route: RouteLine | null;
  leg: 'store' | 'customer';
  follow: boolean;
  onUserPan: () => void;
  bottomInset: number;
};

/**
 * Web has no native map SDK. This draws the same geometry (store, customer,
 * rider, route) as a schematic so the screen stays usable in a browser;
 * turn-by-turn still opens Google Maps.
 */
export const DeliveryMap = forwardRef<DeliveryMapHandle, Props>(
  ({ store, customer, rider, route, leg, bottomInset }, ref) => {
    const { colors: c, dark } = useTheme();
    const [size, setSize] = useState({ width: 0, height: 0 });
    useImperativeHandle(ref, () => ({ fitAll: () => undefined, recenter: () => undefined }));

    const riderCoords = rider ? { latitude: rider.latitude, longitude: rider.longitude } : null;
    const all = [store, customer, riderCoords, ...(route?.points ?? [])].filter(Boolean) as Coordinates[];

    const top = 130;
    const bottom = bottomInset + 30;
    const side = 48;
    const drawW = Math.max(1, size.width - side * 2);
    const drawH = Math.max(1, size.height - top - bottom);

    let project = (_: Coordinates) => ({ x: size.width / 2, y: top + drawH / 2 });
    if (all.length > 0) {
      const lats = all.map((p) => p.latitude);
      const lngs = all.map((p) => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const spanLat = Math.max(maxLat - minLat, 0.002);
      const spanLng = Math.max(maxLng - minLng, 0.002);
      const scale = Math.min(drawW / spanLng, drawH / spanLat);
      const offX = side + (drawW - spanLng * scale) / 2;
      const offY = top + (drawH - spanLat * scale) / 2;
      project = (p) => ({ x: offX + (p.longitude - minLng) * scale, y: offY + (maxLat - p.latitude) * scale });
    }

    const onLayout = (e: LayoutChangeEvent) =>
      setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

    const pin = (point: Coordinates, icon: 'storefront' | 'home', color: string, active: boolean) => {
      const { x, y } = project(point);
      const s = active ? 44 : 36;
      return (
        <View
          key={icon}
          style={[
            styles.pin,
            { left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: s / 2, backgroundColor: color },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={active ? 22 : 18} color="#FFFFFF" />
        </View>
      );
    };

    const gridColor = c.border;

    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceAlt }]} onLayout={onLayout}>
        {size.width > 0 ? (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            <G opacity={0.6}>
              {Array.from({ length: Math.ceil(size.width / 48) }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  x1={i * 48}
                  y1={0}
                  x2={i * 48}
                  y2={size.height}
                  stroke={gridColor}
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.ceil(size.height / 48) }).map((_, i) => (
                <Line key={`h${i}`} x1={0} y1={i * 48} x2={size.width} y2={i * 48} stroke={gridColor} strokeWidth={1} />
              ))}
            </G>
            {route && route.points.length > 1 ? (
              <SvgPolyline
                points={route.points
                  .map((p) => {
                    const { x, y } = project(p);
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke={c.mapRoute}
                strokeWidth={route.kind === 'road' ? 6 : 4}
                strokeDasharray={route.kind === 'straight' ? '12 10' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {riderCoords ? (
              <G>
                <Circle cx={project(riderCoords).x} cy={project(riderCoords).y} r={22} fill={c.brand} opacity={0.18} />
              </G>
            ) : null}
          </Svg>
        ) : null}
        {size.width > 0 && store ? pin(store, 'storefront', dark ? '#5D5A68' : '#16141D', leg === 'store') : null}
        {size.width > 0 && customer ? pin(customer, 'home', c.success, leg === 'customer') : null}
        {size.width > 0 && riderCoords ? (
          <View
            style={[
              styles.rider,
              {
                left: project(riderCoords).x - 18,
                top: project(riderCoords).y - 18,
                backgroundColor: c.brand,
                transform: [{ rotate: `${rider?.heading != null && rider.heading >= 0 ? rider.heading : 0}deg` }],
              },
            ]}
          >
            <MaterialCommunityIcons name="navigation" size={20} color="#FFFFFF" />
          </View>
        ) : null}
        <View style={[styles.note, { backgroundColor: c.surface, top: top - 44 }]}>
          <MaterialCommunityIcons name="map-outline" size={14} color={c.textMuted} />
          <AppText variant="caption" tone="muted">
            Map preview · use Navigate for turn-by-turn
          </AppText>
        </View>
      </View>
    );
  }
);

DeliveryMap.displayName = 'DeliveryMap';

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  rider: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  note: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
});
