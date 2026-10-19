import React, { memo, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { makeStyles, useTheme } from '../../theme';
import { markBroken } from './useCatalogPreview';

const STICKER_PAD = 6;
const STICKER_RADIUS = 14;

/**
 * FloatingProduct — one product picture on the onboarding / login surfaces. Never a grey well:
 *
 *   cut-out (`source.cutout`: the backend's processed images, bundled assets)
 *       stands free on the surface with a soft contact shadow (a small blurred ellipse) under it.
 *   photo (anything else — most catalogue pictures are JPG/PNG on a white background)
 *       · on the white light-mode surface: also free; the white background melts into the surface
 *         and the contact shadow sits just under the picture's bottom edge.
 *       · in dark mode, or on the light canvas (not pure white): a deliberate "sticker" — a white
 *         rounded rect hugging the picture with a small margin and a soft shadow, so the white
 *         background reads as a label, not as a stray box.
 *   A picture that fails to load is dropped from every collage (markBroken) and draws nothing.
 *
 * Props
 *   source   { uri, cutout } | { asset, icon, cutout: true } | null (null = nothing yet)
 *   size     pt, the square box the picture is contained in
 *   on       'surface' (default) | 'canvas' | 'brand' (the violet hero panel: photos are always
 *            stickers there, shadows are tinted violet-black)
 */
function FloatingProductBase({ source, size, on = 'surface' }) {
    const styles = useStyles();
    const { isDark } = useTheme();
    const [failed, setFailed] = useState(false);
    const [ratio, setRatio] = useState(1); // width / height, once loaded (most catalogue photos are square)
    if (!source || failed) return <View style={{ width: size, height: size }} />;

    const sticker = !source.cutout && (isDark || on !== 'surface');
    const pad = size < 60 ? 3 : STICKER_PAD; // small thumbnails keep more of the picture
    const box = sticker ? size - pad * 2 - 4 : source.icon ? size * 0.8 : size;
    const rw = ratio >= 1 ? box : box * ratio;
    const rh = ratio >= 1 ? box / ratio : box;

    const image = (
        <Image
            source={source.uri ? { uri: source.uri } : source.asset}
            style={{ width: rw, height: rh }}
            contentFit="contain"
            transition={220}
            cachePolicy="memory-disk"
            recyclingKey={source.key}
            onLoad={(e) => {
                const w = e?.source?.width;
                const h = e?.source?.height;
                if (w > 0 && h > 0) setRatio(w / h);
            }}
            onError={() => {
                setFailed(true);
                if (source.uri) markBroken(source.uri);
            }}
            accessible={false}
        />
    );

    if (sticker) {
        return (
            <View style={[styles.box, { width: size, height: size }]}>
                <View
                    style={[
                        styles.sticker,
                        {
                            padding: pad,
                            borderRadius: size < 60 ? 8 : STICKER_RADIUS,
                            boxShadow: on === 'brand' ? '0px 8px 18px rgba(24,8,80,0.32)' : `0px 3px 10px rgba(0,0,0,${isDark ? 0.5 : 0.1})`,
                        },
                    ]}
                >
                    {image}
                </View>
            </View>
        );
    }

    // contact shadow: under the object (cut-outs rarely fill their box) or under the photo's edge
    const shadowW = Math.min(rw, size) * 0.55;
    const shadowH = Math.max(3, size * 0.06);
    const bottom = source.cutout ? size * 0.86 : size / 2 + rh / 2 + 1;
    const shadowInk = on === 'brand' ? 'rgba(24,8,80,0.3)' : isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.05)';
    return (
        <View style={[styles.box, { width: size, height: size }]}>
            <View
                style={[
                    styles.contact,
                    {
                        width: shadowW,
                        height: shadowH,
                        left: (size - shadowW) / 2,
                        top: bottom - shadowH / 2,
                        borderRadius: shadowH,
                        backgroundColor: shadowInk,
                        boxShadow: `0px 0px ${Math.round(size * 0.07)}px ${Math.round(size * 0.035)}px ${shadowInk}`,
                    },
                ]}
            />
            {image}
        </View>
    );
}

export const FloatingProduct = memo(FloatingProductBase);

const useStyles = makeStyles(() => ({
    box: { alignItems: 'center', justifyContent: 'center' },
    // a white label in both themes: product photos are shot on white
    sticker: { backgroundColor: '#FFFFFF', borderRadius: STICKER_RADIUS },
    contact: { position: 'absolute' },
}));

export default FloatingProduct;
