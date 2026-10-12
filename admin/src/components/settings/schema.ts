import type { DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import { isValidTimezone } from './logic';
import type { StoreSettings, StoreSettingsUpdate } from './api';

/** Same rules as backend UpdateStoreSettingsDto, with messages that say how to fix it. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_PATTERN = /^\+?[0-9 ]{0,19}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const requiredNumber = (message: string) =>
    z.number({ required_error: message, invalid_type_error: message }).refine(Number.isFinite, message);

export const settingsSchema = z
    .object({
        storeName: z.string().trim().min(1, 'Enter the store name').max(100, 'Use 100 characters or fewer'),
        contactPhone: z
            .string()
            .trim()
            .max(20, 'Use 20 characters or fewer')
            .regex(PHONE_PATTERN, 'Use digits and spaces only, with an optional + at the start'),
        contactEmail: z.union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)]),
        address: z.string().trim().max(500, 'Use 500 characters or fewer'),
        gstin: z
            .string()
            .trim()
            .transform((v) => v.toUpperCase())
            .refine((v) => v === '' || GSTIN_PATTERN.test(v), 'A GSTIN has 15 characters, e.g. 09AAACH7409R1ZZ'),
        timezone: z.string().trim().refine(isValidTimezone, 'Use an IANA timezone such as Asia/Kolkata'),
        openTime: z.union([z.literal(''), z.string().regex(TIME_PATTERN, 'Enter a time')]),
        closeTime: z.union([z.literal(''), z.string().regex(TIME_PATTERN, 'Enter a time')]),
        isActive: z.boolean(),
        latitude: z.number().min(-90, 'Latitude is between -90 and 90').max(90, 'Latitude is between -90 and 90').optional(),
        longitude: z.number().min(-180, 'Longitude is between -180 and 180').max(180, 'Longitude is between -180 and 180').optional(),
        pickupAddress: z.string().trim().max(500, 'Use 500 characters or fewer'),
        serviceRadiusKm: requiredNumber('Enter a delivery radius')
            .refine((n) => n >= 0.5, 'The radius must be at least 0.5 km')
            .refine((n) => n <= 50, 'The radius can be at most 50 km'),
        estimatedDeliveryMinutes: requiredNumber('Enter the delivery time')
            .refine(Number.isInteger, 'Use whole minutes')
            .refine((n) => n >= 1 && n <= 240, 'Use 1 to 240 minutes'),
        deliveryFee: requiredNumber('Enter a delivery fee (0 for free)').refine((n) => n >= 0 && n <= 10_000, 'Use ₹0 to ₹10,000'),
        freeDeliveryThreshold: requiredNumber('Enter an amount (0 = always free)').refine(
            (n) => n >= 0 && n <= 100_000,
            'Use ₹0 to ₹1,00,000',
        ),
        packagingFee: requiredNumber('Enter a packaging fee (0 for none)').refine((n) => n >= 0 && n <= 10_000, 'Use ₹0 to ₹10,000'),
        discountPercent: requiredNumber('Enter a discount (0 for none)').refine((n) => n >= 0 && n <= 90, 'Use 0% to 90%'),
    })
    .superRefine((v, ctx) => {
        if (!!v.openTime !== !!v.closeTime) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [v.openTime ? 'closeTime' : 'openTime'],
                message: 'Set both opening and closing time, or neither',
            });
        }
        const hasLat = typeof v.latitude === 'number';
        const hasLng = typeof v.longitude === 'number';
        if (hasLat !== hasLng) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [hasLat ? 'longitude' : 'latitude'], message: 'Enter both coordinates' });
        }
        if ((hasLat || hasLng) && !v.pickupAddress) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pickupAddress'], message: 'Enter the pickup address riders see' });
        }
    });

export type SettingsFormInput = z.input<typeof settingsSchema>;
export type SettingsFormValues = z.output<typeof settingsSchema>;

/** Form values from the API. Missing values stay empty; nothing is invented. */
export function toFormValues(s: StoreSettings | undefined): DefaultValues<SettingsFormInput> {
    return {
        storeName: s?.storeName ?? '',
        contactPhone: s?.contactPhone ?? '',
        contactEmail: s?.contactEmail ?? '',
        address: s?.address ?? '',
        gstin: s?.gstin ?? '',
        timezone: s?.timezone ?? '',
        openTime: s?.storeTimings?.openTime ?? '',
        closeTime: s?.storeTimings?.closeTime ?? '',
        isActive: s?.isActive ?? true,
        latitude: s?.location?.latitude ?? undefined,
        longitude: s?.location?.longitude ?? undefined,
        pickupAddress: s?.location?.address ?? '',
        serviceRadiusKm: s?.serviceRadiusKm,
        estimatedDeliveryMinutes: s?.estimatedDeliveryMinutes,
        deliveryFee: s?.fees?.deliveryFee,
        freeDeliveryThreshold: s?.fees?.freeDeliveryThreshold,
        packagingFee: s?.fees?.packagingFee,
        discountPercent: typeof s?.fees?.discountRate === 'number' ? Math.round(s.fees.discountRate * 10_000) / 100 : undefined,
    };
}

type DirtyMap = Partial<Record<keyof SettingsFormInput, unknown>>;

/** Partial POST body with only the groups the user changed (the endpoint is a partial update). */
export function toUpdateBody(values: SettingsFormValues, dirty: DirtyMap): StoreSettingsUpdate {
    const is = (key: keyof SettingsFormInput) => Boolean(dirty[key]);
    const body: StoreSettingsUpdate = {};
    if (is('storeName')) body.storeName = values.storeName;
    if (is('contactPhone')) body.contactPhone = values.contactPhone;
    if (is('contactEmail')) body.contactEmail = values.contactEmail;
    if (is('address')) body.address = values.address;
    if (is('gstin')) body.gstin = values.gstin;
    if (is('timezone')) body.timezone = values.timezone;
    if ((is('openTime') || is('closeTime')) && values.openTime && values.closeTime) {
        body.storeTimings = { openTime: values.openTime, closeTime: values.closeTime };
    }
    if (is('isActive')) body.isActive = values.isActive;
    if (
        (is('latitude') || is('longitude') || is('pickupAddress')) &&
        typeof values.latitude === 'number' &&
        typeof values.longitude === 'number'
    ) {
        body.location = { latitude: values.latitude, longitude: values.longitude, address: values.pickupAddress };
    }
    if (is('serviceRadiusKm')) body.serviceRadiusKm = values.serviceRadiusKm;
    if (is('estimatedDeliveryMinutes')) body.estimatedDeliveryMinutes = values.estimatedDeliveryMinutes;
    const fees: NonNullable<StoreSettingsUpdate['fees']> = {};
    if (is('deliveryFee')) fees.deliveryFee = values.deliveryFee;
    if (is('freeDeliveryThreshold')) fees.freeDeliveryThreshold = values.freeDeliveryThreshold;
    if (is('packagingFee')) fees.packagingFee = values.packagingFee;
    if (is('discountPercent')) fees.discountRate = Math.round(values.discountPercent * 100) / 10_000;
    if (Object.keys(fees).length) body.fees = fees;
    return body;
}
