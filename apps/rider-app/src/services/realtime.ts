import { socketService } from './socket';
import { normalizeOrder } from './api';
import { notificationService } from './notifications';
import type { AppDispatch, RootState } from '../store';
import { orderEnded, orderReceived, refreshOrder } from '../store/slices/orderSlice';
import { fetchMetrics } from '../store/slices/metricsSlice';
import { formatMoney } from '../utils/format';
import type { Order } from '../types/order';

type StoreLike = { dispatch: AppDispatch; getState: () => RootState };

let registered = false;

const isMine = (state: RootState, orderId: string) =>
  state.orders.currentOrder?.id === orderId || state.orders.offers.some((offer) => offer.id === orderId);

export const offerSummary = (order: Order) => {
  const parts = [`${order.items.length} item${order.items.length === 1 ? '' : 's'}`];
  if (order.paymentMethod === 'COD') parts.push(`collect ${formatMoney(order.totalAmount)} cash`);
  const drop = order.delivery.address.full;
  if (drop) parts.push(`to ${drop}`);
  return parts.join(' · ');
};

/**
 * All socket listeners live here, registered once for the app's lifetime and
 * dispatched into Redux. Screens only read the store; none of them subscribes
 * to the socket, so there are no duplicate or stale handlers.
 */
export const registerRealtimeHandlers = (store: StoreLike): void => {
  if (registered) return;
  registered = true;
  const { dispatch, getState } = store;
  const myRiderId = () => getState().auth.user?.id;

  socketService.on('newOrderAssignment', (payload: { order?: unknown } | undefined) => {
    if (!payload?.order) return;
    const order = normalizeOrder(payload.order);
    dispatch(orderReceived(order));
    // The server only offers orders to riders it sees as online, so always
    // ring. (The local isOnline copy can lag behind the server.)
    notificationService.alertNewOrder(order.id, order.orderNumber, offerSummary(order)).catch(() => undefined);
  });

  socketService.on(
    'orderPacked',
    (payload: { orderId?: string; order?: unknown; notification?: { title?: string; body?: string } } | undefined) => {
      if (!payload?.orderId) return;
      if (payload.order) {
        dispatch(orderReceived(normalizeOrder(payload.order)));
      } else {
        dispatch(refreshOrder(payload.orderId));
      }
      notificationService
        .notifyUpdate(
          `packed:${payload.orderId}`,
          payload.notification?.title || 'Order packed',
          payload.notification?.body || 'The store has packed your order. Head to the counter for pickup.'
        )
        .catch(() => undefined);
    }
  );

  socketService.on('orderStatusUpdate', (payload: { orderId?: string; status?: string; order?: any } | undefined) => {
    if (!payload?.orderId) return;
    const state = getState();
    const known = isMine(state, payload.orderId);
    if (!payload.order) {
      if (known) dispatch(refreshOrder(payload.orderId));
      return;
    }

    const assignedTo = payload.order.rider?.id || payload.order.riderId?._id || payload.order.riderId;
    const me = myRiderId();
    if (assignedTo && me && String(assignedTo) !== me) {
      // Reassigned to someone else.
      if (known) {
        dispatch(
          orderEnded({
            orderId: payload.orderId,
            orderNumber: payload.order.orderId,
            kind: 'unassigned',
            reason: null,
            self: false,
            at: new Date().toISOString(),
          })
        );
      }
      return;
    }

    const order = normalizeOrder(payload.order);
    if (order.status === 'confirmed') {
      // Back in the pool (e.g. after a rejection). Offers only come from
      // newOrderAssignment; here we only refresh one that is still mine.
      if (!known) return;
      if (!assignedTo || String(assignedTo) !== me) {
        dispatch(
          orderEnded({
            orderId: order.id,
            orderNumber: order.orderNumber,
            kind: 'unassigned',
            reason: null,
            self: false,
            at: new Date().toISOString(),
          })
        );
        return;
      }
    }
    if (order.status === 'cancelled') {
      if (known) {
        dispatch(
          orderEnded({
            orderId: order.id,
            orderNumber: order.orderNumber,
            kind: 'cancelled',
            reason: order.cancellationReason ?? null,
            self: false,
            at: new Date().toISOString(),
          })
        );
      }
      return;
    }

    dispatch(orderReceived(order));
    if (order.status === 'delivered') dispatch(fetchMetrics());
  });

  socketService.on(
    'orderCancelled',
    (payload: { orderId?: string; orderNumber?: string; reason?: string | null } | undefined) => {
      if (!payload?.orderId) return;
      const known = isMine(getState(), payload.orderId);
      dispatch(
        orderEnded({
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          kind: 'cancelled',
          reason: payload.reason ?? null,
          self: false,
          at: new Date().toISOString(),
        })
      );
      if (known) {
        notificationService
          .notifyUpdate(
            `cancelled:${payload.orderId}`,
            `Order ${payload.orderNumber || ''} cancelled`.replace(/\s+/g, ' ').trim(),
            payload.reason ? `Reason: ${payload.reason}` : 'You do not need to deliver this order.'
          )
          .catch(() => undefined);
      }
    }
  );

  socketService.on(
    'orderUnassigned',
    (payload: { orderId?: string; orderNumber?: string; reason?: string } | undefined) => {
      if (!payload?.orderId) return;
      const self = payload.reason === 'rider_rejected';
      const known = isMine(getState(), payload.orderId);
      dispatch(
        orderEnded({
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          kind: 'unassigned',
          reason: payload.reason ?? null,
          self,
          at: new Date().toISOString(),
        })
      );
      if (known && !self) {
        const expired = payload.reason === 'offer_expired';
        notificationService
          .notifyUpdate(
            `unassigned:${payload.orderId}`,
            `${expired ? 'Request' : 'Order'} ${payload.orderNumber || ''} ${expired ? 'expired' : 'reassigned'}`
              .replace(/\s+/g, ' ')
              .trim(),
            expired
              ? 'You did not answer in time, so it went to another rider.'
              : 'The store has moved this order to another rider.'
          )
          .catch(() => undefined);
      }
    }
  );
};
