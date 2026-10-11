/**
 * SessionKeeper keeps a signed-in customer signed in, and signs them out cleanly
 * when the server says the session is over. Renders nothing; mount once inside
 * the Redux Provider and the NavigationContainer (App.js).
 *
 * - Renews the access token in the background on start, when the app comes back
 *   to the foreground, and shortly before it expires while the app is open.
 *   It never blocks the UI: the saved session is shown immediately.
 * - Session ended (refresh returned 401, see services/api.js): disconnects the
 *   realtime socket, opens Login and shows a toast. The local cart is kept.
 *   Network errors never get here, so being offline never signs anyone out.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';
import { ensureFreshAccessToken } from '../services/api';
import { REFRESH_SKEW_MS, getTokenExpiryMs, onSessionEnded } from '../services/session';
import socketService from '../services/socketService';
import { navigationRef } from '../navigation/navigationRef';
import { t } from '../constants/translations';
import { store } from '../store';
import { toast } from './ui';

// setTimeout misbehaves above ~24.8 days; renewals are far sooner than this anyway.
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;
// Splash decides where to go by itself (it reads the auth state when it hands over).
const SELF_ROUTING = ['Splash', 'Login', 'OTP', 'LanguageSelection', 'Onboarding'];

const renew = () => {
    ensureFreshAccessToken().catch(() => undefined);
};

const openLogin = () => {
    if (!navigationRef.isReady()) return;
    const current = navigationRef.getCurrentRoute()?.name;
    if (SELF_ROUTING.includes(current)) return;
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
};

export default function SessionKeeper() {
    const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
    const token = useSelector((s) => s.auth.token);

    useEffect(() => onSessionEnded(() => {
        socketService.disconnect();
        openLogin();
        const language = store.getState().language?.currentLanguage || 'en';
        toast.error(t('sessionEnded', language), { duration: 5000 });
    }), []);

    // Restored or fresh sign-in: renew in the background if the token is stale.
    useEffect(() => {
        if (isAuthenticated) renew();
    }, [isAuthenticated]);

    // Back from the background: the access token has often expired meanwhile.
    useEffect(() => {
        if (!isAuthenticated) return undefined;
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') renew();
        });
        return () => sub.remove();
    }, [isAuthenticated]);

    // While the app is open, renew a minute before the access token expires.
    useEffect(() => {
        if (!isAuthenticated || !token) return undefined;
        const exp = getTokenExpiryMs(token);
        if (exp === null) return undefined;
        const delay = Math.min(Math.max(exp - REFRESH_SKEW_MS - Date.now(), 0), MAX_TIMER_MS);
        const timer = setTimeout(() => {
            if (AppState.currentState === 'active') renew();
        }, delay);
        return () => clearTimeout(timer);
    }, [isAuthenticated, token]);

    return null;
}
