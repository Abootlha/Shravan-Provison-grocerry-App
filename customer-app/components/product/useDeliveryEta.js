import { useServiceArea } from '../../screens/address/useServiceArea';

/**
 * Delivery ETA in minutes from store settings (estimatedDeliveryMinutes), 10 until it loads.
 * Backed by useServiceArea's module cache, so every card shares one GET /settings/store.
 */
export function useDeliveryEta() {
    return useServiceArea().etaMinutes || 10;
}
