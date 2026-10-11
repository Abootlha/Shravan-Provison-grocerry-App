import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './useAuth';
import {
  fetchAvailableOrders,
  hydrateCurrentOrder,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  addAvailableOrder,
  setCurrentOrder,
  removeAvailableOrder,
} from '../store/slices/orderSlice';
import { socketService } from '../services/socket';
import { normalizeOrder } from '../services/api';
import type { Order, AvailableOrder, OrderStatus } from '../types/order';

export const useOrders = () => {
  const dispatch = useAppDispatch();
  const { currentOrder, availableOrders, loading, error } = useAppSelector(
    (state) => state.orders
  );

  useEffect(() => {
    const handleNewOrder = (data: { order: AvailableOrder }) => {
      dispatch(addAvailableOrder(normalizeOrder(data.order) as AvailableOrder));
    };

    const handleStatusUpdate = (data: { orderId: string; status: OrderStatus; order?: Order }) => {
      const normalizedOrder = data.order ? normalizeOrder(data.order) : null;
      const nextStatus = String(data.status || '').toUpperCase();

      if (data.orderId === currentOrder?.id && data.order) {
        if (['DELIVERED', 'CANCELLED'].includes(nextStatus)) {
          dispatch(setCurrentOrder(null));
        } else {
          dispatch(setCurrentOrder(normalizedOrder));
        }
        return;
      }

      if (
        ['CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(nextStatus) &&
        normalizedOrder
      ) {
        dispatch(addAvailableOrder(normalizedOrder as AvailableOrder));
      }
    };

    const handlePackedUpdate = (data: { orderId: string; status: string; order?: Order }) => {
      const normalizedOrder = data.order ? normalizeOrder(data.order) : null;

      if (data.orderId === currentOrder?.id && data.order) {
        dispatch(setCurrentOrder(normalizedOrder));
      }

      if (normalizedOrder) {
        dispatch(addAvailableOrder(normalizedOrder as AvailableOrder));
      }
    };

    socketService.onNewOrderAssignment(handleNewOrder as never);
    socketService.onOrderStatusUpdate(handleStatusUpdate as never);
    socketService.onOrderPacked(handlePackedUpdate as never);

    return () => {
      socketService.offNewOrderAssignment(handleNewOrder as never);
      socketService.offOrderStatusUpdate(handleStatusUpdate as never);
      socketService.offOrderPacked(handlePackedUpdate as never);
    };
  }, [dispatch, currentOrder?.id]);

  const loadAvailableOrders = useCallback(() => {
    dispatch(fetchAvailableOrders());
  }, [dispatch]);

  const loadCurrentOrder = useCallback(() => {
    dispatch(hydrateCurrentOrder());
  }, [dispatch]);

  const accept = useCallback(
    async (orderId: string) => {
      const result = await dispatch(acceptOrder(orderId));
      return acceptOrder.fulfilled.match(result) ? (result.payload as Order) : null;
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
      location?: { latitude: number; longitude: number },
      deliveryOtp?: string
    ) => {
      const result = await dispatch(updateOrderStatus({ orderId, status, location, deliveryOtp }));
      return updateOrderStatus.fulfilled.match(result) ? (result.payload as Order) : null;
    },
    [dispatch]
  );

  // Marks DELIVERED with the OTP the customer reads out. The server verifies
  // it (400 on a wrong OTP, lockout after repeated failures); its message is returned.
  const completeDelivery = useCallback(
    async (
      orderId: string,
      deliveryOtp: string,
      location?: { latitude: number; longitude: number }
    ): Promise<{ order: Order | null; error: string | null }> => {
      const result = await dispatch(
        updateOrderStatus({ orderId, status: 'delivered', location, deliveryOtp })
      );
      if (updateOrderStatus.fulfilled.match(result)) {
        return { order: result.payload as Order, error: null };
      }
      return { order: null, error: (result.payload as string) || 'Failed to complete delivery' };
    },
    [dispatch]
  );

  return {
    completeDelivery,
    currentOrder,
    availableOrders,
    loading,
    error,
    loadAvailableOrders,
    loadCurrentOrder,
    accept,
    reject,
    updateStatus,
  };
};
