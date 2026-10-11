/**
 * The floating dark surface shared by FloatingCartBar, ActiveOrderBar and CartThumbStack's ring
 * (DESIGN.md: "Cart pill/toasts use ink #151515; dark: raised #232323 + hairline"). `surfaceNight`
 * resolves to ink in light and the raised layer in dark; dark adds a neutral hairline so the bar
 * stays a distinct object over the list. No violet rim.
 */
export const nightPill = (t) =>
    t.isDark
        ? { backgroundColor: t.colors.surfaceNight, borderWidth: 1, borderColor: t.colors.border }
        : { backgroundColor: t.colors.surfaceNight };

/** The bar's fill alone (rings that must blend into it, e.g. CartThumbStack). */
export const nightPillFill = (t) => t.colors.surfaceNight;
