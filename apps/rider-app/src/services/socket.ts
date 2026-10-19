import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import { refreshAccessToken } from './authSession';
import { storage } from './storage';

type SocketEventHandler = (...args: any[]) => void;

export type SocketState = 'disconnected' | 'connecting' | 'connected';

/** Retry delay after a refresh that failed for a transient reason (offline, 5xx). */
const AUTH_RETRY_MS = 10_000;

/**
 * One shared socket to the /tracking namespace.
 *
 * Auth (see docs/api/rider-tracking.md): the token is checked on connect. A
 * rejected handshake (`connect_error` "unauthorized") or an `auth_error` on an
 * open socket means: refresh the access token, set it on `socket.auth`, and
 * connect again. socket.io does not retry either case by itself.
 */
class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private listeners = new Map<string, Set<SocketEventHandler>>();
  private stateListeners = new Set<(state: SocketState) => void>();
  private authRefreshing = false;
  private authRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private state: SocketState = 'disconnected';

  connect(token: string): void {
    if (this.socket) {
      if (this.token === token) {
        if (!this.socket.connected && !this.socket.active) this.socket.connect();
        return;
      }
      // Token renewed elsewhere (REST interceptor, app foreground): the open
      // connection stays valid; the new token is used for the next handshake.
      this.token = token;
      this.socket.auth = { token };
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }

    this.token = token;
    this.setState('connecting');
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.setState('connected');
      // The server joins rider_<id> automatically; this is an idempotent safety net.
      socket.emit('joinRiderRoom');
    });

    socket.on('disconnect', (reason) => {
      this.setState('disconnected');
      if (__DEV__) console.log('[socket] disconnected:', reason);
      // A server-side disconnect is not retried by socket.io. Unless it was
      // preceded by auth_error (handled below), try again with a fresh token.
      if (reason === 'io server disconnect') this.handleAuthFailure();
    });

    socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
      this.setState('disconnected');
      if (__DEV__) console.log('[socket] connect_error:', error.message, error.data?.code);
      if (error.message === 'unauthorized') {
        this.handleAuthFailure();
      } else if (error.message === 'auth_unavailable') {
        // Server could not check the token right now (e.g. session store down):
        // the token is fine, so retry the same one later. socket.io will not.
        this.scheduleRetry();
      }
    });

    socket.on('auth_error', (payload: { code?: string } | undefined) => {
      if (__DEV__) console.log('[socket] auth_error:', payload?.code);
      this.handleAuthFailure();
    });

    socket.io.on('reconnect_attempt', () => this.setState('connecting'));

    for (const [event, handlers] of this.listeners.entries()) {
      for (const handler of handlers) socket.on(event, handler);
    }
  }

  private handleAuthFailure(): void {
    if (this.authRefreshing || !this.socket) return;
    this.authRefreshing = true;
    if (this.authRetryTimer) {
      clearTimeout(this.authRetryTimer);
      this.authRetryTimer = null;
    }
    refreshAccessToken()
      .catch(() => null)
      .then(async (token) => {
        if (!this.socket) return;
        if (token) {
          this.token = token;
          this.socket.auth = { token };
          this.setState('connecting');
          this.socket.connect();
          return;
        }
        // No refresh token left means the session is over; App.tsx signs out.
        if (!(await storage.getRefreshToken())) return;
        this.authRetryTimer = setTimeout(() => this.handleAuthFailure(), AUTH_RETRY_MS);
      })
      .finally(() => {
        this.authRefreshing = false;
      });
  }

  private scheduleRetry(): void {
    if (this.authRetryTimer || !this.socket) return;
    this.authRetryTimer = setTimeout(() => {
      this.authRetryTimer = null;
      if (this.socket && !this.socket.connected) {
        this.setState('connecting');
        this.socket.connect();
      }
    }, AUTH_RETRY_MS);
  }

  private setState(state: SocketState): void {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  getState(): SocketState {
    return this.state;
  }

  onStateChange(listener: (state: SocketState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  disconnect(): void {
    if (this.authRetryTimer) {
      clearTimeout(this.authRetryTimer);
      this.authRetryTimer = null;
    }
    if (this.socket) {
      this.socket.io.off('reconnect_attempt');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.setState('disconnected');
  }

  /** Register a handler that survives reconnects. Returns an unsubscribe function. */
  on(event: string, handler: SocketEventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    this.socket?.on(event, handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    };
  }

  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) this.socket.emit(event, data);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
