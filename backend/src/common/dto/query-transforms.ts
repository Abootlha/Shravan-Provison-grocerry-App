import { Transform } from 'class-transformer';

/** Query-string boolean: "true"/"1" → true, "false"/"0" → false. */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  });

/** Comma-separated (or repeated) query values → string[]. */
export const ToStringArray = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = Array.isArray(value) ? value : String(value).split(',');
    return list.map((v) => String(v).trim()).filter(Boolean);
  });

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Standard pagination envelope fields returned next to the named list. */
export const pageMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});
