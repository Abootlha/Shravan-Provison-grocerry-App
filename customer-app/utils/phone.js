/**
 * One rule for Indian mobile numbers, shared by Login and the address form.
 *
 *   normalizeMobile('+91 98765 43210') -> '9876543210'   (drops +91 / 91 / leading 0, spaces, dashes)
 *   isValidMobile('09876543210')       -> true             (10 digits starting 6-9, same as the backend's
 *                                                            RECEIVER_PHONE_PATTERN in users/dto/address.dto.ts)
 *   mobileError(raw, isHi)             -> null when valid or empty, else a message that says WHY
 */

/** Digits only, without a +91 / 91 / 0 prefix (when what's left is 10 digits). */
export const normalizeMobile = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
};

export const isValidMobile = (raw) => /^[6-9]\d{9}$/.test(normalizeMobile(raw));

/** Why a typed number can't be used (null when it's fine or still empty). */
export const mobileError = (raw, isHi) => {
    const digits = normalizeMobile(raw);
    if (!digits) return null;
    if (digits.length !== 10) {
        return isHi ? '10 अंकों का मोबाइल नंबर दर्ज करें' : 'Enter a 10-digit mobile number';
    }
    if (!/^[6-9]/.test(digits)) {
        return isHi ? 'मोबाइल नंबर 6, 7, 8 या 9 से शुरू होता है' : 'Mobile numbers start with 6, 7, 8 or 9';
    }
    return null;
};

/** "+91 98765 43210" for display; anything that isn't a 10-digit number is returned as typed. */
export const formatMobile = (raw) => {
    const digits = normalizeMobile(raw);
    return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : String(raw ?? '');
};
