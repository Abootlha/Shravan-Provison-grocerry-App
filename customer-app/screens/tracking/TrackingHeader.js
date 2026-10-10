/**
 * Tracking chrome + the ETA headline.
 *
 *   <MapChrome orderCode live showLive onBack onHelp topInset isHi />
 *       Round back / help buttons over the map (IconButton glass + allowBlur — the one place blur is
 *       allowed on this screen), with a solid surface label "#CODE · Live" between them.
 *   <EtaHead copy stateKey etaMinutes onTime isHi />
 *       Top of the sheet: status line + "On time" note, then the screen's ONE mixed-weight headline:
 *       "Arriving in **8 mins**" (Headline display, emphasis in brand violet). Statuses without an ETA
 *       show copy.title as a plain h1 instead. When `stateKey` (the order status) changes, the copy
 *       crossfades into the new status (ContentSwap).
 *   <TrackingBar orderCode onBack onHelp isHi />
 *       Plain canvas bar for states without a map (delivered / cancelled).
 * Motion: none of its own beyond the ContentSwap on a status change. Nothing loops.
 */
import React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space, radii } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { ContentSwap, Headline, IconButton, Text } from '../../components/ui';

export function MapChrome({ orderCode, live, showLive = true, onBack, onHelp, topInset = 0, isHi }) {
    const styles = useStyles();
    return (
        <View style={[styles.chrome, { top: topInset + space.sm }, { pointerEvents: 'box-none' }]}>
            <IconButton name="arrow-left" variant="glass" allowBlur accessibilityLabel={isHi ? 'वापस जाएँ' : 'Go back'} onPress={onBack} />
            <View style={styles.codeLabel}>
                <Text variant="label" tabular numberOfLines={1}>#{orderCode}</Text>
                {showLive ? (
                    <Text
                        variant="caption"
                        color={live ? 'success' : 'muted'}
                        accessibilityLabel={live ? (isHi ? 'लाइव ट्रैकिंग चालू' : 'Live tracking connected') : isHi ? 'लाइव ट्रैकिंग से जुड़ रहा है' : 'Connecting to live tracking'}
                    >
                        {live ? (isHi ? '· लाइव' : '· Live') : isHi ? '· जुड़ रहा है' : '· Connecting'}
                    </Text>
                ) : null}
            </View>
            <IconButton name="lifebuoy" variant="glass" allowBlur accessibilityLabel={isHi ? 'मदद लें' : 'Get help'} onPress={onHelp} />
        </View>
    );
}

export function EtaHead({ copy, stateKey, etaMinutes, onTime, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const showEta = copy?.eta && Number.isFinite(etaMinutes);
    const unit = isHi ? 'मिनट' : etaMinutes === 1 ? 'min' : 'mins';

    return (
        <ContentSwap stateKey={stateKey || copy?.title || 'eta'}>
        <View style={styles.head} accessibilityLiveRegion="polite">
            <View style={styles.metaRow}>
                <Text variant="label" color="secondary" numberOfLines={1} style={styles.flex}>{copy?.micro}</Text>
                {onTime ? (
                    <View style={styles.onTime}>
                        <MaterialCommunityIcons name="clock-check-outline" size={14} color={colors.successInk} />
                        <Text variant="caption" color={colors.successInk}>{isHi ? 'समय पर' : 'On time'}</Text>
                    </View>
                ) : null}
            </View>

            {showEta ? (
                <Headline
                    variant="display"
                    lead={isHi ? undefined : 'Arriving in'}
                    emphasis={`${etaMinutes} ${unit}`}
                    trail={isHi ? 'में पहुँचेगा' : undefined}
                    emphasisColor="brand"
                    tabular
                    accessibilityLabel={isHi ? `${etaMinutes} मिनट में पहुँचेगा` : `Arriving in ${etaMinutes} ${etaMinutes === 1 ? 'minute' : 'minutes'}`}
                />
            ) : (
                <Text variant="h1" accessibilityRole="header" style={styles.title}>
                    {copy?.title || (isHi ? 'जल्द पहुँचेगा' : 'Arriving soon')}
                </Text>
            )}

            {copy?.sub ? <Text variant="body" color="secondary" numberOfLines={2}>{copy.sub}</Text> : null}
        </View>
        </ContentSwap>
    );
}

export function TrackingBar({ orderCode, onBack, onHelp, isHi }) {
    const styles = useStyles();
    return (
        <View style={styles.bar}>
            <IconButton name="arrow-left" variant="ghost" accessibilityLabel={isHi ? 'वापस जाएँ' : 'Go back'} onPress={onBack} />
            <Text variant="title" numberOfLines={1} accessibilityRole="header">
                {isHi ? 'ऑर्डर' : 'Order'} #{orderCode}
            </Text>
            <IconButton name="lifebuoy" variant="ghost" accessibilityLabel={isHi ? 'मदद लें' : 'Get help'} onPress={onHelp} />
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    chrome: {
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.sm,
    },
    // solid label over the map: surface + hairline + the floating shadow (it floats above the map)
    codeLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        height: 36,
        paddingHorizontal: space.md,
        flexShrink: 1,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surfaceRaised,
        ...t.shadows.floating,
    },
    head: { gap: space.xxs },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
    onTime: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    title: { marginTop: space.xxs },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs, minHeight: 56 },
}));

export default EtaHead;
