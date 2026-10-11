import { useStoreStatus } from '../../hooks/useStoreSettings';

/**
 * What a product card's delivery chip should say, from the store settings (one shared request):
 *   { minutes, closedLabel }
 *   - open with a known estimatedDeliveryMinutes → minutes = N
 *   - closed → closedLabel = "Opens 8 AM"
 *   - unknown → both null (render no chip; never a guessed "10 mins")
 */
export function useDeliveryEta(isHi = false) {
    const status = useStoreStatus();
    if (!status.isOpen) return { minutes: null, closedLabel: status.opensLabel(isHi) };
    return { minutes: status.etaMinutes, closedLabel: null };
}
