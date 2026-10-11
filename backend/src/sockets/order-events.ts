import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/** Customer order rooms (`order:<orderId>`) receive `statusUpdate`. */
export const ORDER_STATUS_CHANNEL = 'order-updates';
/** The `admin:orders` room receives `order:new` / `order:updated`. */
export const ADMIN_ORDER_EVENTS_CHANNEL = 'admin-order-events';

export type OrderEventChannel =
  | typeof ORDER_STATUS_CHANNEL
  | typeof ADMIN_ORDER_EVENTS_CHANNEL;

export const ORDER_EVENT_CHANNELS: OrderEventChannel[] = [
  ORDER_STATUS_CHANNEL,
  ADMIN_ORDER_EVENTS_CHANNEL,
];

/**
 * Identifies this process in Redis messages, so the gateway can skip copies
 * of events it already delivered locally.
 */
export const ORDER_EVENTS_ORIGIN = randomUUID();

/**
 * In-process bus. OrdersService emits here first, so sockets connected to the
 * same process get events even when Redis pub/sub is down or misconfigured;
 * Redis only fans events out to other processes.
 */
export const localOrderEvents = new EventEmitter();

export type OrderEventPayload = Record<string, unknown>;

export function emitLocalOrderEvent(
  channel: OrderEventChannel,
  payload: OrderEventPayload,
): void {
  localOrderEvents.emit('event', channel, payload);
}
