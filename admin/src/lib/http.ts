import { toast } from 'sonner';
import { appConfig } from './config';
import {
    getValidAccessToken,
    redirectToLogin,
    refreshSession,
    SessionRefreshUnavailableError,
} from './session';

/**
 * Error thrown for every non-2xx response. `message` is always human readable (taken from
 * the backend's `message`, never raw JSON), so it can go straight into a toast or form error.
 */
export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    /** Every validation message when the backend returned a list. */
    readonly messages: string[];
    readonly body: unknown;

    constructor(init: { status: number; message: string; code?: string; messages?: string[]; body?: unknown }) {
        super(init.message);
        this.name = 'ApiError';
        this.status = init.status;
        this.code = init.code;
        this.messages = init.messages ?? [init.message];
        this.body = init.body;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/** Best human-readable message for anything thrown by a request. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof SessionRefreshUnavailableError) return error.message;
    if (error instanceof TypeError) return 'Could not reach the server. Check your connection and retry.';
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

const STATUS_FALLBACK: Record<number, string> = {
    400: 'The request was not valid.',
    401: 'Your session has ended. Please log in again.',
    403: "You don't have permission to do that.",
    404: 'Not found.',
    409: 'This conflicts with existing data.',
    413: 'The upload is too large.',
    422: 'Some fields are not valid.',
    429: 'Too many requests. Wait a moment and retry.',
};

async function toApiError(response: Response): Promise<ApiError> {
    let body: any = undefined;
    const text = await response.text().catch(() => '');
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    const raw = body && typeof body === 'object' ? body.message : undefined;
    let messages = Array.isArray(raw)
        ? raw.filter((m): m is string => typeof m === 'string')
        : typeof raw === 'string' && raw.trim()
            ? [raw.trim()]
            : [];
    // Framework defaults ("Forbidden resource", "Unauthorized") say less than our own copy.
    if (messages.length === 1 && /^(forbidden( resource)?|unauthorized|not found|internal server error)$/i.test(messages[0])) {
        messages = [];
    }
    const fallback =
        STATUS_FALLBACK[response.status] ??
        (response.status >= 500 ? 'The server had a problem. Please retry.' : `Request failed (${response.status}).`);
    return new ApiError({
        status: response.status,
        code: body && typeof body === 'object' && typeof body.code === 'string' ? body.code : undefined,
        message: messages.length ? messages.join('. ') : fallback,
        messages: messages.length ? messages : [fallback],
        body,
    });
}

export type QueryParams = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
    /** Query string values; null/undefined/'' are skipped, arrays repeat the key. */
    params?: QueryParams;
    /** JSON-serialised unless it is FormData/Blob/string. */
    body?: unknown;
    /** Skip attaching/refreshing the access token (login, refresh). */
    skipAuth?: boolean;
    /** Base URL override; defaults to PUBLIC_API_URL. */
    baseUrl?: string;
}

export function buildUrl(path: string, params?: QueryParams, baseUrl = appConfig.apiBaseUrl): string {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (!params) return url;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value)) value.forEach((v) => query.append(key, String(v)));
        else query.append(key, String(value));
    }
    const qs = query.toString();
    return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

let lastForbiddenToast = 0;
function notifyForbidden(message: string) {
    // Several queries can fail together; show one toast, not a stack.
    if (Date.now() - lastForbiddenToast < 3000) return;
    lastForbiddenToast = Date.now();
    toast.error("You don't have permission", {
        id: 'forbidden',
        description: message === STATUS_FALLBACK[403] ? 'Your role cannot do this. Ask an admin for access.' : message,
    });
}

/**
 * Authenticated JSON request against the backend. Refreshes once on 401; a 401 that
 * survives the refresh ends the session. 403 keeps the session and shows a toast.
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, body, skipAuth = false, baseUrl, headers: extraHeaders, ...init } = options;
    const inBrowser = typeof window !== 'undefined';
    const url = buildUrl(path, params, baseUrl);

    const isRawBody =
        body instanceof FormData || body instanceof Blob || typeof body === 'string' || body === undefined;
    const payload = body === undefined ? undefined : isRawBody ? (body as BodyInit) : JSON.stringify(body);

    const send = (accessToken: string | null) => {
        const headers = new Headers(extraHeaders);
        if (payload !== undefined && !(body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
        return fetch(url, { ...init, headers, body: payload });
    };

    const token = inBrowser && !skipAuth ? await getValidAccessToken() : null;
    let response = await send(token);

    if (response.status === 401 && inBrowser && !skipAuth) {
        const outcome = await refreshSession();
        if (outcome.status === 'ok') {
            response = await send(outcome.token);
        } else if (outcome.status === 'unavailable') {
            throw new SessionRefreshUnavailableError();
        } else {
            redirectToLogin(outcome.reason);
        }
    }

    if (!response.ok) {
        const error = await toApiError(response);
        if (response.status === 401 && inBrowser && !skipAuth) redirectToLogin(error.code);
        if (response.status === 403 && inBrowser && !skipAuth) notifyForbidden(error.message);
        throw error;
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as T;
    }
}

type BodyOptions = Omit<RequestOptions, 'body' | 'method'>;

/** Typed helpers. Each resolves to parsed JSON and rejects with ApiError. */
export const http = {
    get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(path, { ...options, method: 'GET' }),
    post: <T = unknown>(path: string, body?: unknown, options?: BodyOptions) =>
        request<T>(path, { ...options, method: 'POST', body }),
    put: <T = unknown>(path: string, body?: unknown, options?: BodyOptions) =>
        request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T = unknown>(path: string, body?: unknown, options?: BodyOptions) =>
        request<T>(path, { ...options, method: 'PATCH', body }),
    del: <T = unknown>(path: string, options?: BodyOptions & { body?: unknown }) =>
        request<T>(path, { ...options, method: 'DELETE' }),
};

export const { get, post, put, patch, del } = http;
