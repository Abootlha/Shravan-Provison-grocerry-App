/**
 * OrderTrackingMap (web) — Leaflet map for live order tracking.
 *
 * Props
 *   riderLocation      { latitude, longitude } | null
 *   customerLocation   { latitude, longitude } | null
 *   storeLocation      { latitude, longitude } | null
 *   routeCoordinates   [{ latitude, longitude }]
 *   riderHeading       degrees (0 = north)
 *   orderStatus        order status string
 *   onMapReady         () => void
 *   viewportPadding    { top, bottom } — px of the map hidden behind other UI; fitting keeps markers clear of it
 *   fitKey             any value; when it changes the map re-fits all markers (e.g. map expanded/collapsed)
 *
 * The container is always rendered first and Leaflet is initialised into it afterwards
 * (the old version waited for Leaflet before rendering its container, so it never loaded).
 * The rider glides between socket updates (interpolated over the real update interval) and its
 * heading arrow rotates through the shortest angle with a CSS transition.
 *
 * Theme: light uses a quiet neutral (greyscale) OSM basemap. Dark keeps the same keyless OSM tiles
 * and inverts them into a low-contrast dark basemap with a CSS filter; the pins, rider and route are rebuilt in the
 * dark palette. Switching theme restyles tiles and swaps icons in place (no re-init).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { makeStyles, useTheme } from '../theme';
import { WEB_TILES } from './OrderTrackingMapStyle';
import { durations, easings } from '../theme/motion';
import { Skeleton, Text } from './ui';
import { snapPointToRoute } from '../services/directionsService';
import Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [26.7606, 83.3732];
const DEFAULT_ZOOM = 14;
const PATHS = {
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    store: 'M5 4h14a1 1 0 0 1 1 1v2H4V5a1 1 0 0 1 1-1zm-1 4h16l1 5h-1v7h-2v-6h-4v6H4v-7H3l1-5zm2 6v4h6v-4H6z',
    arrow: 'M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71z',
};

const valid = (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0);

const pinHtml = (t, bg, fg, path) => `
  <div style="width:36px;height:44px;display:flex;flex-direction:column;align-items:center;">
    <div style="width:36px;height:36px;border-radius:50%;background:${bg};border:3px solid ${t.colors.surface};
      box-shadow:${t.shadows.floating.boxShadow || 'none'};display:flex;align-items:center;justify-content:center;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${fg}"><path d="${path}"/></svg>
    </div>
    <div style="width:8px;height:8px;margin-top:-5px;transform:rotate(45deg);background:${bg};border-right:2px solid ${t.colors.surface};border-bottom:2px solid ${t.colors.surface};"></div>
  </div>`;

const riderHtml = (t, deg = 0) => `
  <div class="sk-rider" style="position:relative;width:48px;height:48px;">
    <div style="position:absolute;left:8px;top:8px;width:32px;height:32px;border-radius:50%;background:${t.colors.brand};
      border:3px solid ${t.colors.surface};box-shadow:${t.shadows.floating.boxShadow || 'none'};
      display:flex;align-items:center;justify-content:center;">
      <svg class="sk-rider-arrow" width="16" height="16" viewBox="0 0 24 24" fill="${t.colors.onBrand}"
        style="transform:rotate(${deg}deg);transition:transform 420ms cubic-bezier(0.23,1,0.32,1);"><path d="${PATHS.arrow}"/></svg>
    </div>
  </div>`;

const STYLE_ID = 'sk-tracking-map-style';
// (Re)written whenever the scheme changes — one <style> element, never duplicated.
const injectStyles = (t) => {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    const { colors } = t;
    const basemap = t.isDark
        ? `
      /* Dark: the same OSM tiles, inverted into a quiet low-contrast neutral basemap. */
      .sk-track-map .leaflet-tile { filter: invert(1) hue-rotate(180deg) grayscale(0.85) brightness(0.92) contrast(0.88); }
      .sk-track-map .leaflet-control-attribution { background: ${colors.glassSolid}; color: ${colors.inkMuted}; font-size: 10px; line-height: 14px; border-radius: 8px 0 0 0; padding: 1px 6px; }
      .sk-track-map .leaflet-control-attribution a { color: ${colors.brandText}; }`
        : `
      /* Quiet neutral basemap so the violet route and the pins carry the colour. */
      .sk-track-map .leaflet-tile { filter: grayscale(0.9) brightness(1.04) contrast(0.92); }`;
    el.textContent = `
      @media (prefers-reduced-motion: reduce) { .sk-rider-arrow { transition: none !important; } }
      .leaflet-container { background: ${colors.surfaceSunken}; font-family: inherit; }${basemap}
    `;
};

const OrderTrackingMap = ({
    riderLocation,
    customerLocation,
    storeLocation,
    routeCoordinates = [],
    riderHeading = 0,
    orderStatus,
    onMapReady,
    viewportPadding,
    fitKey,
}) => {
    const styles = useStyles();
    const theme = useTheme();
    const { colors, scheme } = theme;
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const containerRef = useRef(null);
    const LRef = useRef(null);
    const mapRef = useRef(null);
    const layers = useRef({});
    const riderPos = useRef(null);
    const lastFixAt = useRef(0);
    const frame = useRef(null);
    const angle = useRef(0);
    const onReadyRef = useRef(onMapReady);
    onReadyRef.current = onMapReady;
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    // 1) Container exists from the first render; initialise Leaflet into it.
    useEffect(() => {
        let cancelled = false;
        let observer;
        (async () => {
            try {
                const L = Leaflet;
                const node = containerRef.current;
                if (cancelled || !node || mapRef.current) return;
                injectStyles(themeRef.current);
                LRef.current = L;
                node.classList?.add('sk-track-map');
                const map = L.map(node, { zoomControl: false, attributionControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
                mapRef.current = map;
                // Only touch the map while it is still mounted: a late resize / frame after
                // map.remove() throws "_leaflet_pos" of undefined inside Leaflet.
                const resize = () => {
                    if (!cancelled && mapRef.current === map) map.invalidateSize();
                };
                if (typeof ResizeObserver !== 'undefined') {
                    observer = new ResizeObserver(resize);
                    observer.observe(node);
                }
                requestAnimationFrame(resize);
                setReady(true);
                onReadyRef.current?.();
            } catch (error) {
                console.warn('Failed to load map:', error);
                if (!cancelled) setFailed(true);
                onReadyRef.current?.();
            }
        })();
        return () => {
            cancelled = true;
            observer?.disconnect();
            if (frame.current) cancelAnimationFrame(frame.current);
            mapRef.current?.remove();
            mapRef.current = null;
            layers.current = {};
        };
    }, []);

    // 1b) Basemap for the active scheme: swap the tile layer (+ attribution in dark) in place.
    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!ready || !L || !map) return;
        injectStyles(themeRef.current);
        const l = layers.current;
        const tiles = WEB_TILES[scheme] || WEB_TILES.light;
        if (!l.tiles || l.tilesUrl !== tiles.url) {
            if (l.tiles) map.removeLayer(l.tiles);
            l.tiles = L.tileLayer(tiles.url, { maxZoom: 19, attribution: tiles.attribution || undefined }).addTo(map);
            l.tilesUrl = tiles.url;
            l.tiles.bringToBack?.();
        }
        if (l.attribution) {
            map.removeControl(l.attribution);
            l.attribution = null;
        }
        if (tiles.attribution) {
            l.attribution = L.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution(tiles.attribution).addTo(map);
        }
        // Rebuild icons in the new palette: static pins via effect 2 (they're keyed on scheme), the rider here.
        ['customer', 'store'].forEach((k) => {
            if (l[k]) map.removeLayer(l[k]);
            l[k] = null;
        });
        if (l.rider) {
            l.rider.setIcon(L.divIcon({ html: riderHtml(themeRef.current, angle.current), className: '', iconSize: [48, 48], iconAnchor: [24, 24] }));
        }
    }, [ready, scheme]);

    // 2) Static markers + route.
    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!ready || !L || !map) return;
        const l = layers.current;

        const setMarker = (key, pos, html, size, anchor) => {
            if (!valid(pos)) {
                if (l[key]) map.removeLayer(l[key]);
                l[key] = null;
                return;
            }
            if (l[key]) {
                l[key].setLatLng([pos.latitude, pos.longitude]);
                return;
            }
            l[key] = L.marker([pos.latitude, pos.longitude], {
                icon: L.divIcon({ html, className: '', iconSize: size, iconAnchor: anchor }),
                keyboard: false,
            }).addTo(map);
        };
        const t = themeRef.current;
        setMarker('customer', customerLocation, pinHtml(t, colors.surfaceInverse, colors.inkInverse, PATHS.home), [36, 44], [18, 44]);
        setMarker('store', storeLocation, pinHtml(t, colors.brand, colors.onBrand, PATHS.store), [36, 44], [18, 44]);

        ['routeCasing', 'route'].forEach((k) => {
            if (l[k]) map.removeLayer(l[k]);
            l[k] = null;
        });
        if (routeCoordinates?.length > 1) {
            const pts = routeCoordinates.map((c) => [c.latitude, c.longitude]);
            l.routeCasing = L.polyline(pts, { color: colors.surface, weight: 9, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
            l.route = L.polyline(pts, { color: colors.brandText, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        } else if (['PENDING', 'CONFIRMED'].includes(orderStatus) && valid(storeLocation) && valid(customerLocation)) {
            l.route = L.polyline(
                [
                    [storeLocation.latitude, storeLocation.longitude],
                    [customerLocation.latitude, customerLocation.longitude],
                ],
                { color: colors.inkMuted, weight: 3, opacity: 0.8, dashArray: '2, 8', lineCap: 'round' }
            ).addTo(map);
        }
    }, [ready, scheme, customerLocation?.latitude, customerLocation?.longitude, storeLocation?.latitude, storeLocation?.longitude, routeCoordinates, orderStatus]);

    // 3) Rider: glide between fixes over the real update interval (constant motion → linear).
    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!ready || !L || !map) return;
        const l = layers.current;
        if (!valid(riderLocation)) {
            if (l.rider) map.removeLayer(l.rider);
            l.rider = null;
            riderPos.current = null;
            return;
        }
        const target = routeCoordinates?.length > 1 ? snapPointToRoute(riderLocation, routeCoordinates, 90).point : riderLocation;
        if (!l.rider) {
            riderPos.current = target;
            l.rider = L.marker([target.latitude, target.longitude], {
                icon: L.divIcon({ html: riderHtml(themeRef.current, angle.current), className: '', iconSize: [48, 48], iconAnchor: [24, 24] }),
                zIndexOffset: 1000,
                keyboard: false,
            }).addTo(map);
            lastFixAt.current = Date.now();
            return;
        }
        const now = Date.now();
        const duration = Math.min(Math.max(now - lastFixAt.current, 500), 2500);
        lastFixAt.current = now;
        const from = riderPos.current || target;
        const startedAt = performance.now();
        if (frame.current) cancelAnimationFrame(frame.current);
        const step = (t) => {
            const p = Math.min(1, (t - startedAt) / duration);
            const next = {
                latitude: from.latitude + (target.latitude - from.latitude) * p,
                longitude: from.longitude + (target.longitude - from.longitude) * p,
            };
            riderPos.current = next;
            l.rider?.setLatLng([next.latitude, next.longitude]);
            if (p < 1) frame.current = requestAnimationFrame(step);
        };
        frame.current = requestAnimationFrame(step);
    }, [ready, riderLocation?.latitude, riderLocation?.longitude, routeCoordinates]);

    // 4) Heading: rotate the arrow through the shortest angle (CSS transition, interruptible).
    useEffect(() => {
        const marker = layers.current.rider;
        if (!ready || !marker || !Number.isFinite(riderHeading)) return;
        const current = angle.current;
        let delta = ((riderHeading - current) % 360 + 540) % 360 - 180;
        angle.current = current + delta;
        const arrow = marker.getElement?.()?.querySelector('.sk-rider-arrow');
        if (arrow) arrow.style.transform = `rotate(${angle.current}deg)`;
    }, [ready, riderHeading, riderLocation?.latitude]);

    // 5) Fit everything into the visible part of the map.
    const hasRider = valid(riderLocation);
    useEffect(() => {
        const L = LRef.current;
        const map = mapRef.current;
        if (!ready || !L || !map) return;
        const pts = [customerLocation, storeLocation, riderPos.current || riderLocation].filter(valid).map((p) => [p.latitude, p.longitude]);
        const top = (viewportPadding?.top || 0) + 40;
        const bottom = (viewportPadding?.bottom || 0) + 40;
        map.invalidateSize();
        if (pts.length >= 2) {
            map.fitBounds(pts, { paddingTopLeft: [40, top], paddingBottomRight: [40, bottom], maxZoom: 16, animate: true });
        } else if (pts.length === 1) {
            map.setView(pts[0], 15, { animate: true });
        }
    }, [ready, fitKey, orderStatus, hasRider, customerLocation?.latitude, storeLocation?.latitude, viewportPadding?.top, viewportPadding?.bottom]);

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: withTiming(ready ? 0 : 1, { duration: durations.base, easing: easings.out }),
    }));

    return (
        <View style={styles.container}>
            <View ref={containerRef} style={styles.map} />
            <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle, { pointerEvents: ready ? 'none' : 'auto' }]}>
                {failed ? (
                    <Text variant="label" color="muted" align="center">Map couldn’t load. Your order status below is still live.</Text>
                ) : (
                    <Skeleton width="100%" height={2000} radius={0} style={StyleSheet.absoluteFill} />
                )}
            </Animated.View>
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    container: { flex: 1, backgroundColor: t.colors.surfaceSunken, overflow: 'hidden' },
    map: { flex: 1 },
    overlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceSunken },
}));

export default OrderTrackingMap;
