import { useCallback, useEffect } from 'react';
import { useAppSelector } from './useAuth';
import { socketService } from '../services/socket';

export const useSocket = () => {
  const { token, isAuthenticated, user } = useAppSelector((state) => state.auth);

  // Hold a reference to the shared socket while authenticated. Unmounting this
  // hook only releases the reference; the socket closes when no consumer is left.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    socketService.retain();
    return () => {
      socketService.release();
    };
  }, [isAuthenticated]);

  // connect() is idempotent: it reuses the socket for the same token and swaps
  // it out when the token changes (e.g. after a refresh).
  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token, user?.id);
    }
  }, [isAuthenticated, token, user?.id]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketService.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketService.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: unknown[]) => void) => {
    socketService.off(event, handler);
  }, []);

  return {
    isConnected: socketService.isConnected(),
    emit,
    on,
    off,
  };
};
