/**
 * Prefix of the status-log note written when a rider rejects an order.
 * Rider metrics count these to compute the acceptance rate.
 */
export const RIDER_REJECTED_NOTE = 'rider_rejected';

/**
 * Status-log note when an offer times out without an answer. Deliberately not
 * RIDER_REJECTED_NOTE: a missed alert must not lower the acceptance rate.
 */
export const RIDER_OFFER_EXPIRED_NOTE = 'offer_expired';

/** How long a rider has to accept or reject an offer before it moves on. */
export const OFFER_RESPONSE_TIMEOUT_MS = 60_000;
