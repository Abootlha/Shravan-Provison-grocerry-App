// DEV-ONLY mock API. Must only be loaded through a guarded require:
//   if ((__DEV__ && process.env.EXPO_PUBLIC_MOCK_API === '1') || process.env.EXPO_PUBLIC_PERF_MOCK === '1') require('../mocks')...
// so production bundles never contain it. See mocks/README.md.
import axios from 'axios';
import { Platform } from 'react-native';
import { handle } from './router';
import { findOrder } from './db';

const delay = () => new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));

const parseQuery = (qs = '') => qs.split('&').reduce((acc, pair) => {
    if (!pair) return acc;
    const [k, v = ''] = pair.split('=');
    acc[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    return acc;
}, {});

/** Absolute or relative URL -> { path (without origin and /api/v1), query }. */
const splitUrl = (url) => {
    const [beforeHash] = String(url || '').split('#');
    const [rawPath, qs] = beforeHash.split('?');
    const path = rawPath
        .replace(/^[a-z]+:\/\/[^/]+/i, '')
        .replace(/^\/api\/v\d+/, '')
        .replace(/\/+$/, '') || '/';
    return { path, query: parseQuery(qs) };
};

const joinUrl = (baseURL, url) => {
    if (!baseURL || /^[a-z]+:\/\//i.test(url || '')) return url || '';
    return `${baseURL.replace(/\/+$/, '')}/${String(url || '').replace(/^\/+/, '')}`;
};

const parseBody = (data) => {
    if (data == null || data === '') return undefined;
    if (typeof data !== 'string') return data;
    try { return JSON.parse(data); } catch { return data; }
};

const headerValue = (headers, name) => {
    if (!headers) return undefined;
    if (typeof headers.get === 'function') return headers.get(name) || undefined;
    return headers[name] || headers[name.toLowerCase()];
};

const log = (method, path, status) => {
    // Quiet in release (perf-mock) builds so logging doesn't skew profiles.
    if (__DEV__ && typeof console !== 'undefined') console.log(`[mock api] ${method} ${path} -> ${status}`);
};

const mockAdapter = async (config) => {
    await delay();
    const method = String(config.method || 'get').toUpperCase();
    const { path, query } = splitUrl(joinUrl(config.baseURL, config.url));
    const result = handle({
        method,
        path,
        query: { ...query, ...(config.params || {}) },
        body: parseBody(config.data),
        authorization: headerValue(config.headers, 'Authorization'),
    });
    log(method, path, result.status);

    // Deep copy so callers can't mutate the mock DB through responses.
    const response = {
        data: JSON.parse(JSON.stringify(result.body ?? null)),
        status: result.status,
        statusText: result.status < 400 ? 'OK' : 'Error',
        headers: { 'content-type': 'application/json' },
        config,
        request: { mock: true },
    };
    const validate = config.validateStatus || ((s) => s >= 200 && s < 300);
    if (validate(result.status)) return response;
    throw new axios.AxiosError(
        `Request failed with status code ${result.status}`,
        result.status >= 500 ? axios.AxiosError.ERR_BAD_RESPONSE : axios.AxiosError.ERR_BAD_REQUEST,
        config,
        response.request,
        response,
    );
};

/** Routes fetch() calls aimed at the backend (maps proxy) to the mock router. */
const installFetchMock = (apiBaseUrl) => {
    const g = typeof globalThis !== 'undefined' ? globalThis : global;
    if (!g.fetch || g.fetch.__mockApi) return;
    const realFetch = g.fetch.bind(g);
    const prefix = String(apiBaseUrl || '').replace(/\/+$/, '');

    const mockFetch = async (input, init = {}) => {
        const url = typeof input === 'string' ? input : input?.url;
        if (!prefix || !url || !url.startsWith(prefix)) return realFetch(input, init);
        await delay();
        const method = String(init.method || input?.method || 'GET').toUpperCase();
        const { path, query } = splitUrl(url);
        const result = handle({
            method,
            path,
            query,
            body: parseBody(init.body),
            authorization: headerValue(init.headers, 'Authorization'),
        });
        log(method, path, result.status);
        return new Response(JSON.stringify(result.body ?? null), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    mockFetch.__mockApi = true;
    g.fetch = mockFetch;
};

/**
 * Web: PayU checkout is an auto-submitted <form> that leaves the app. In mock
 * mode, short-circuit it to the app's own return URL, exactly like the backend's
 * PAYMENT_RETURN_URL redirect (?payment=success&orderId=...). The app then polls
 * GET /orders/:id, which reports COMPLETED on the second poll.
 */
const installPayUFormMock = () => {
    if (Platform.OS !== 'web' || typeof HTMLFormElement === 'undefined') return;
    const proto = HTMLFormElement.prototype;
    if (proto.submit.__mockApi) return;
    const realSubmit = proto.submit;
    const mockSubmit = function submit() {
        if (/payu\.in/i.test(this.action || '')) {
            const txnid = this.querySelector('input[name="txnid"]')?.value;
            const order = txnid ? findOrder(txnid) : null;
            const orderId = order?._id || txnid || '';
            console.log('[mock api] PayU redirect intercepted for order', orderId);
            setTimeout(() => {
                window.location.assign(`${window.location.origin}/?payment=success&orderId=${encodeURIComponent(orderId)}`);
            }, 800);
            return undefined;
        }
        return realSubmit.call(this);
    };
    mockSubmit.__mockApi = true;
    proto.submit = mockSubmit;
};

let installed = false;

export const installMockApi = (clients = [], { apiBaseUrl } = {}) => {
    [axios, ...clients].forEach((client) => {
        if (client?.defaults) client.defaults.adapter = mockAdapter;
    });
    if (installed) return;
    installed = true;
    installFetchMock(apiBaseUrl);
    installPayUFormMock();
    console.log(
        '%c[mock api] ENABLED - all backend calls are served from customer-app/mocks (any phone, OTP 1234)',
        'color:#fff;background:#7c3aed;padding:2px 6px;border-radius:3px',
    );
};

export { createMockSocket } from './mockSocket';
export { resetMockDb } from './db';
