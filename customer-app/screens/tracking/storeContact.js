/**
 * Contact the store about an order, from GET /settings/store (contactPhone, else contactEmail).
 *   const contact = useStoreContact();          // { phone, email, available }
 *   contactStore(contact, { orderCode, isHi })   // tel: first, else mailto: with the order code
 */
import { Linking } from 'react-native';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import { toast } from '../../components/ui';

export function useStoreContact() {
    const { settings } = useStoreSettings();
    const phone = settings?.contactPhone || null;
    const email = settings?.contactEmail || null;
    return { phone, email, available: Boolean(phone || email) };
}

export function contactStore({ phone, email } = {}, { orderCode, isHi } = {}) {
    if (phone) return Linking.openURL(`tel:${String(phone).replace(/\s/g, '')}`);
    if (email) {
        const subject = encodeURIComponent(orderCode
            ? (isHi ? `ऑर्डर #${orderCode} में समस्या` : `Issue with order #${orderCode}`)
            : (isHi ? 'मदद चाहिए' : 'I need help'));
        return Linking.openURL(`mailto:${email}?subject=${subject}`);
    }
    toast.info(isHi ? 'स्टोर का संपर्क अभी उपलब्ध नहीं है' : 'The store’s contact details aren’t available right now', {
        description: isHi ? 'कनेक्शन जांचें और फिर से प्रयास करें।' : 'Check your connection and try again.',
    });
    return null;
}
