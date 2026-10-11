import { registerDecorator, ValidationOptions } from 'class-validator';

export const MAX_IMAGE_URL_LENGTH = 2048;
/** Max length of a base64 data: URI (~1.1MB of binary image data). */
export const MAX_IMAGE_DATA_URI_LENGTH = 1_500_000;
const MAX_PLAIN_ICON_LENGTH = 100;

const DATA_URI_PATTERN =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export interface ImageSourceOptions {
  /** Also accept a short plain token (icon name / emoji) that is not a URL. */
  allowPlainIcon?: boolean;
}

export function isValidImageSource(
  value: unknown,
  options: ImageSourceOptions = {},
): boolean {
  if (typeof value !== 'string') return false;
  if (value === '') return true;

  if (value.startsWith('data:')) {
    return (
      value.length <= MAX_IMAGE_DATA_URI_LENGTH && DATA_URI_PATTERN.test(value)
    );
  }

  if (/^https?:\/\//i.test(value)) {
    if (value.length > MAX_IMAGE_URL_LENGTH) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  // Server-relative path (e.g. /uploads/x.jpg)
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.length <= MAX_IMAGE_URL_LENGTH;
  }

  if (options.allowPlainIcon) {
    return value.length <= MAX_PLAIN_ICON_LENGTH && !value.includes(':');
  }

  return false;
}

/**
 * Accepts an http(s) URL (max 2048 chars), a base64 image data: URI
 * (max ~1.5MB) or an empty string. Works with `each: true` for arrays.
 */
export function IsImageSource(
  options: ImageSourceOptions = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isImageSource',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an http(s) URL (max ${MAX_IMAGE_URL_LENGTH} chars) or a base64 image data URI (max ${MAX_IMAGE_DATA_URI_LENGTH} chars)`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isValidImageSource(value, options),
      },
    });
  };
}
