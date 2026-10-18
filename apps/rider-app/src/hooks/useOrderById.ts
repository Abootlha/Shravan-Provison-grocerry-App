import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from './useAuth';
import { apiErrorMessage, mergeOrder, orderApi } from '../services/api';
import { refreshOrder } from '../store/slices/orderSlice';
import type { EndedOrder, Order } from '../types/order';

/**
 * An order the rider is looking at: live from the store when it is the active
 * order or an offer (socket updates flow in), otherwise fetched once.
 * `ended` is set when the order was cancelled / taken away meanwhile.
 */
export const useOrderById = (orderId: string) => {
  const dispatch = useAppDispatch();
  const live = useAppSelector((s) =>
    s.orders.currentOrder?.id === orderId
      ? s.orders.currentOrder
      : (s.orders.offers.find((offer) => offer.id === orderId) ?? null)
  );
  const ended: EndedOrder | null = useAppSelector((s) => s.orders.ended[orderId] ?? null);
  const [fetched, setFetched] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (live) {
        await dispatch(refreshOrder(orderId));
      } else {
        setFetched(await orderApi.getById(orderId));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this order.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, orderId, Boolean(live)]);

  useEffect(() => {
    if (!live && !ended) reload();
    // Only on mount / when the order leaves the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Keep the last known copy when the order leaves the store (e.g. just
  // delivered) so the screen does not flash empty before navigating away.
  const last = useRef<Order | null>(null);
  const resolved = live ? mergeOrder(fetched, live) : fetched;
  if (resolved) last.current = resolved;
  const order = ended ? null : (resolved ?? last.current);
  return { order, ended, loading: loading && !order, error, reload, isLive: Boolean(live) };
};
