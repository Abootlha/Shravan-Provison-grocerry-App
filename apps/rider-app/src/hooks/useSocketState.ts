import { useEffect, useState } from 'react';
import { socketService, SocketState } from '../services/socket';

export const useSocketState = (): SocketState => {
  const [state, setState] = useState<SocketState>(socketService.getState());
  useEffect(() => {
    setState(socketService.getState());
    return socketService.onStateChange(setState);
  }, []);
  return state;
};
