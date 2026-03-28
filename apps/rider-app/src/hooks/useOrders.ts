import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './useAuth';
import {
  fetchAvailableOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  addAvailableOrder,
  setCurrentOrder,
  removeAvailableOrder,
} from '../store/slices/orderSlice';
import { socketService } from '../services/socket';
import type { Order, AvailableOrder, OrderStatus } from '../types/order';

export const useOrders = () => {
  const dispatch = useAppDispatch();
  const { currentOrder, availableOrders, loading, error } = useAppSelector(
    (state) => state.orders
  );

  useEffect(() => {
    const handleNewOrder = (data: { order: AvailableOrder }) => {
      dispatch(addAvailableOrder(data.order));
    };

    const handleStatusUpdate = (data: { orderId: string; status: OrderStatus; order?: Order }) => {
      if (data.orderId === currentOrder?.id && data.order) {
        dispatch(setCurrentOrder(data.order));
      }
    };

    socketService.onNewOrderAssignment(handleNewOrder as never);
    socketService.onOrderStatusUpdate(handleStatusUpdate as never);

    return () => {
      socketService.offNewOrderAssignment(handleNewOrder as never);
      socketService.offOrderStatusUpdate(handleStatusUpdate as never);
    };
  }, [dispatch, currentOrder?.id]);

  const loadAvailableOrders = useCallback(() => {
    dispatch(fetchAvailableOrders());
  }, [dispatch]);

  const accept = useCallback(
    async (orderId: string) => {
      const result = await dispatch(acceptOrder(orderId));
      return result.payload as Order | null;
    },
    [dispatch]
  );

  const reject = useCallback(
    async (orderId: string) => {
      await dispatch(rejectOrder(orderId));
      dispatch(removeAvailableOrder(orderId));
    },
    [dispatch]
  );

  const updateStatus = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      location?: { latitude: number; longitude: number }
    ) => {
      const result = await dispatch(updateOrderStatus({ orderId, status, location }));
      return result.payload as Order | null;
    },
    [dispatch]
  );

  return {
    currentOrder,
    availableOrders,
    loading,
    error,
    loadAvailableOrders,
    accept,
    reject,
    updateStatus,
  };
};
