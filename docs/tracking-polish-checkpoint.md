# Tracking Polish Checkpoint

## Objective
Make customer delivery tracking feel closer to a production delivery app by improving:
- route visibility
- smooth rider marker movement
- route refresh when rider deviates
- ETA freshness
- clearer route state before and after rider acceptance

## Current Status
Completed in this pass.

## Completed Work
- Added proper pre-rider dotted store-to-customer path for `PENDING` and `CONFIRMED`
- Fixed Mappls route integration in both customer app and backend ETA service to use the correct route endpoint and geometry shape
- Added smooth rider marker interpolation on customer mobile map
- Added route snapping so rider marker stays visually closer to the routed road geometry
- Added active-leg route refresh every 25 seconds using latest rider/destination refs
- Added deviation-triggered reroute refresh when rider drifts materially from the current route
- Preserved the last good route during transient directions failures to avoid flicker
- Reduced backend ETA cache TTL from 120s to 30s for fresher traffic-aware timing
- Updated tracking slice so live location updates also refresh distance, duration, ETA, and route info more consistently

## Validation
- `customer-app`: `npm run typecheck` passed
- `backend`: `npm run build` passed

## Next Optional Polishes
- Smooth marker interpolation on web/admin tracking views too
- Heading smoothing / dampening for rider marker rotation
- Route corridor visualization and stale-location warning UI
- Traffic refresh cadence tuning after real device testing
