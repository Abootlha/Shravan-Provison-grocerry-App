import { z } from 'zod';

/** Mirrors the backend's image-source check (products/dto/image-source.validator.ts). */
export function imageSchema({ allowPlainIcon = false, required = false }: { allowPlainIcon?: boolean; required?: boolean } = {}) {
    return z
        .string()
        .trim()
        .superRefine((value, ctx) => {
            if (!value) {
                if (required) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add an image: paste a link or upload one' });
                return;
            }
            if (value.startsWith('data:')) {
                if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(value)) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Upload a PNG, JPG, WebP or GIF' });
                } else if (value.length > 1_500_000) {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That upload is too large. Use an image under 1 MB' });
                }
                return;
            }
            if (/^https?:\/\//i.test(value)) {
                try {
                    new URL(value);
                } catch {
                    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That link is not a valid URL' });
                }
                if (value.length > 2048) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That link is too long (2048 characters max)' });
                return;
            }
            if (value.startsWith('/') && !value.startsWith('//')) return;
            if (allowPlainIcon && value.length <= 100 && !value.includes(':')) return;
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Paste a link starting with https://, or upload an image' });
        });
}

/** Banner images must be hosted on https (the API rejects anything else). */
export const httpsUrl = (message: string) =>
    z
        .string()
        .trim()
        .min(1, message)
        .max(2000, 'That link is too long')
        .refine((v) => {
            try {
                return new URL(v).protocol === 'https:';
            } catch {
                return false;
            }
        }, 'Use a link that starts with https://');
