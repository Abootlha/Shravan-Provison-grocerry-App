import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiErrorMessage, riderApi } from '../services/api';
import type { DeliveriesPage, DeliveryPeriod, RiderDelivery } from '../types/delivery';

/**
 * The rider's completed deliveries for a period (GET /riders/me/deliveries).
 * Reloads whenever the screen comes into focus (e.g. back from a delivery)
 * and when `refreshKey` changes (pass today's delivery count so a new
 * delivery shows up right away). `loadMore` appends the next page.
 */
export const useDeliveries = (period: DeliveryPeriod, limit = 20, refreshKey?: unknown) => {
  const [deliveries, setDeliveries] = useState<RiderDelivery[]>([]);
  const [totals, setTotals] = useState<DeliveriesPage['totals'] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (nextPage = 1) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const res = await riderApi.getDeliveries(period, nextPage, limit);
        if (id !== request.current) return; // a newer request (e.g. period switch) won
        setDeliveries((prev) => (nextPage === 1 ? res.deliveries : [...prev, ...res.deliveries]));
        setTotals(res.totals);
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (id === request.current) setError(apiErrorMessage(err, 'Could not load your deliveries.'));
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [period, limit]
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, refreshKey])
  );

  return {
    deliveries,
    totals,
    loading,
    error,
    hasMore: page < totalPages,
    refresh: () => load(1),
    loadMore: () => load(page + 1),
  };
};
