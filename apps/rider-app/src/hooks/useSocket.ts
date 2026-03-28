import { useCallback, useEffect } from 'react';
import { useAppSelector } from './useAuth';
import { socketService } from '../services/socket';

export const useSocket = () => {
  const { token, isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token);
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, token]);

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
