/**
 * WellLight — @deprecated, renders nothing.
 *
 * It used to paint a soft radial light behind packshots on the dark image well. DESIGN.md removes
 * decorative glow: the well is a flat neutral (#F2F2F0 light / #202020 dark) and packshots sit on it
 * as they are. The component is kept (same props) so existing call sites don't break; remove it from
 * screens during the screen pass.
 */
import { memo } from 'react';

// eslint-disable-next-line no-unused-vars
export const WellLight = memo(function WellLight(_props) {
    return null;
});

export default WellLight;
