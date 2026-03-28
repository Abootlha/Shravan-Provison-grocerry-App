# Maps, Routing, ETA, and Dispatch System Design

## Goal

Design a scalable, low-latency mapping and routing architecture for this grocery delivery platform so that:

- nearest rider selection is based on road travel time, not just straight-line distance
- route generation is reliable and fast
- ETA becomes progressively more accurate during the order lifecycle
- live tracking scales without putting route computation on the websocket hot path
- the platform can grow from a single-city grocery app into a multi-city delivery network

This document combines:

- current-project analysis
- the provided Uber system design reference from Karan Pratap Singh
- deeper research from Uber, Grab, DoorDash, H3, Valhalla, Mapbox, and OSRM-related sources

## Executive Summary

The current project already has a useful starting point:

- rider locations are stored as geo points and queried with MongoDB geospatial search
- Redis is already available for low-latency cache use
- websocket tracking exists
- ETA recomputation already exists

But the current architecture is still an MVP routing stack, not a production-grade dispatch system:

- the mobile client directly calls Google Directions
- ETA is recomputed synchronously in the rider location update flow
- nearest rider selection is based on Mongo `$near`, which is spatially good but not travel-time optimal
- there is no map matching pipeline, route versioning, matrix service, or dispatch scoring service
- cache keys are point-to-point only and too coarse for a large-scale routing strategy

The recommended architecture is:

1. Move all route, ETA, and matrix logic behind backend services.
2. Use a two-stage dispatch algorithm:
   - stage 1: very fast geospatial candidate generation with H3 + geo index
   - stage 2: travel-time scoring with a matrix/routing engine
3. Separate three concerns:
   - geospatial indexing
   - routing/matrix computation
   - dispatch decisioning
4. Add map matching and traffic-aware ETA correction so live ETAs improve with real rider motion.
5. Keep Google/Mapbox as fallback or premium provider, but make the platform provider-agnostic.
6. Prefer a self-hosted routing core for cost control and algorithmic flexibility once order volume grows.

My recommendation for this platform:

- short term: Mapbox or Google Routes/Matrix via backend only
- medium term: self-hosted Valhalla for route, matrix, isochrone, and map matching
- geospatial index: H3
- event backbone: Kafka or Redis Streams initially, Kafka at scale
- live location store: Redis Geo / in-memory dispatch index, backed by Mongo persistence

## What Exists In This Project Today

### Frontend

The client currently fetches directions directly from Google Directions API:

- `src/services/directionsService.js`

Problems:

- API key exposure risk
- no backend control over quotas, fallbacks, caching, cost, or route quality
- route logic becomes fragmented across clients

### Backend

Relevant services:

- `backend/src/modules/riders/riders.service.ts`
- `backend/src/modules/orders/eta.service.ts`
- `backend/src/sockets/tracking.gateway.ts`
- `backend/src/common/utils/redis.service.ts`

Current strengths:

- rider location persistence exists
- nearby rider search uses MongoDB geospatial queries
- Redis is already integrated
- websocket room model is already usable for live order tracking

Current limitations:

- `findNearbyRiders()` uses proximity, not routing ETA
- `updateLocation()` triggers ETA recalculation inline for every out-for-delivery order
- ETA cache is a simple origin-destination TTL cache, not cell-based, not traffic-model aware
- there is no routing abstraction layer, so replacing providers will be painful later
- no separation between rider telemetry ingestion, dispatch scoring, and customer-facing ETA delivery

## Key Research Takeaways

### 1. Uber: routing and ETA must be first-class platform services

Uber’s routing writeup and tech stack notes show a pattern that is still valid:

- dedicated routing services
- historical traffic + real-time corrections
- massive ETA quality measurement using ETA vs ATA
- very fast serving paths with heavy preprocessing

Useful takeaway for us:

- routing should be a platform capability, not an app utility
- ETA accuracy must be measured continuously, not assumed

### 2. Grab: nearest by road network beats nearest by straight line

Grab’s Pharos article is especially relevant for this app.

Their core insight:

- the rider who is closest in haversine distance is often not the fastest to reach the pickup point

They solve this with:

- road-network-aware KNN
- in-memory distributed storage
- graph-partitioned search
- termination by ETA/routing-distance threshold

This is directly applicable to grocery delivery.

### 3. DoorDash: routing, dispatch, and ETA must be simulation-tested

DoorDash engineering highlights two important ideas:

- route optimization and dispatch become asynchronous and region-sharded at scale
- location/routing systems should be tested using simulation, not only live traffic

For this app, simulation is important because:

- rider update frequency
- order batching
- store wait time
- traffic changes
- customer density by zone

all strongly affect ETA accuracy and rider assignment quality.

### 4. H3 is the right spatial partitioning primitive

Uber’s H3 is a strong fit for:

- rider bucketing
- nearby cell expansion
- surge/load heatmaps
- cache locality
- ETA feature engineering

H3 is not the routing engine itself. It is the spatial indexing layer that helps candidate retrieval and geo aggregation stay fast.

### 5. Valhalla gives the best self-hosted long-term foundation

Valhalla supports:

- route
- matrix
- isochrones
- map matching
- optimized routes

That combination makes it a better long-term fit than a thin directions-only dependency.

### 6. Managed providers are still useful

Mapbox Navigation and Google Routes APIs remain very useful for:

- fast launch
- fallback routing
- premium traffic coverage
- bootstrapping data quality in early stages

The right design is not "choose only one forever." The right design is a provider abstraction with controlled failover.

## Product-Specific Requirements For This Grocery Platform

This is not identical to Uber ride-hailing.

Important differences:

- pickup is mostly from a fixed merchant/store node
- destination is customer address
- some orders may be grouped or stacked
- route quality matters for delivery time and freshness
- nearest-rider logic should optimize pickup ETA first, then total fulfillment ETA
- store prep time matters just as much as road time

So the dispatch objective should be:

`minimize predicted fulfillment time = rider_to_store + wait_at_store + store_to_customer + risk_penalty`

Not:

`minimize straight-line distance to customer`

## Recommended High-Level Architecture

### Core services

1. API Gateway
2. Order Service
3. Rider Service
4. Dispatch Service
5. Routing Service
6. ETA Service
7. Location Ingestion Service
8. Tracking Service
9. Traffic/Telemetry Pipeline
10. Observability and Simulation Service

### Responsibilities

#### Order Service

- owns order lifecycle
- emits events like `order.created`, `order.packed`, `order.assigned`, `order.delivered`

#### Rider Service

- owns rider availability, capacity, vehicle type, shift state
- persists last known location

#### Location Ingestion Service

- receives rider GPS pings
- validates, rate limits, deduplicates
- map matches noisy coordinates
- updates hot location store
- publishes location events asynchronously

This should be separate from tracking fanout.

#### Routing Service

- route API abstraction
- matrix API abstraction
- isochrone API abstraction
- map matching API abstraction
- provider failover
- route cache and matrix cache

#### Dispatch Service

- candidate rider generation
- rider scoring
- assignment recommendations
- re-dispatch if timeout/reject/no-show

#### ETA Service

- computes predicted pickup ETA
- computes predicted delivery ETA
- fuses map route duration with store prep and rider behavior signals

#### Tracking Service

- websocket or SSE fanout only
- serves rider location, route progress, ETA deltas, state changes

Do not make routing computations inside this hot path.

## Recommended Request Flows

### A. Order creation to assignment

1. Customer places order.
2. Order Service emits `order.created`.
3. Store prep service estimates ready time.
4. Dispatch Service requests nearby candidate riders from Location Index.
5. Dispatch Service asks Routing/Matrix Service for travel times from candidate riders to store.
6. Dispatch scoring ranks candidates using:
   - rider to store ETA
   - store ready time alignment
   - rider utilization
   - battery/network reliability if available
   - current workload / stacked order compatibility
7. Best rider(s) are offered the job.
8. Assignment result is published.

### B. Out-for-delivery live tracking

1. Rider app sends location pings every 2-5 seconds when moving.
2. Location Ingestion Service:
   - validates signal quality
   - discards jitter
   - map matches coordinates
   - updates rider hot-location entry
   - emits telemetry event
3. ETA Service recomputes only when significant movement or traffic change occurs.
4. Tracking Service pushes:
   - smoothed rider location
   - route progress
   - ETA updates
   - status changes

### C. Re-dispatch

Triggered when:

- rider rejects
- rider goes offline
- rider stalls
- ETA breaches threshold

The Dispatch Service should re-query candidates using the same two-stage process.

## Recommended Data Architecture

### System of record

Use MongoDB only as the durable operational store for:

- orders
- users
- rider profile/state
- delivery history

Do not use MongoDB as the primary hot path for dispatch decisions.

### Hot path stores

#### Redis

Use Redis for:

- current rider locations
- availability bitsets / lightweight state
- short TTL route and matrix caches
- websocket session metadata
- order tracking snapshots

#### H3 index

Each rider location update should also map the rider into H3 cells.

Recommended pattern:

- resolution 8 or 9 for city-zone candidate generation
- resolution 10 or 11 for dense urban refinement

Store:

- rider ID
- vehicle type
- availability
- last update time
- last matched edge ID if map matched

### Analytical storage

For telemetry and ETA model training:

- Kafka topics
- warehouse or lakehouse sink later

Useful event streams:

- rider.location.raw
- rider.location.matched
- route.requested
- route.served
- eta.predicted
- eta.actual
- dispatch.candidates
- dispatch.assigned

## Routing Engine Strategy

### Stage 1: launch fast with managed provider behind backend

Best immediate option:

- move all directions/matrix calls to backend
- choose Mapbox or Google Routes/Distance Matrix equivalent through a routing adapter

Why:

- faster delivery
- less operational overhead
- access to live traffic

### Stage 2: build provider abstraction

Create a `RoutingProvider` interface:

- `getRoute(origin, destination, profile)`
- `getMatrix(sources, targets, profile)`
- `matchTrace(points, profile)`
- `getIsochrone(origin, timeBudget, profile)`

Implement:

- `GoogleRoutingProvider`
- `MapboxRoutingProvider`
- later `ValhallaRoutingProvider`

### Stage 3: self-host Valhalla for cost and control

Valhalla is the best long-term fit because it supports the exact primitives we need:

- matrix for candidate ranking
- route for turn-by-turn path
- map matching for noisy rider GPS
- isochrones for dispatch reachability

Recommended deployment:

- one routing cluster per region
- OSM extracts by region
- periodic tile rebuilds
- traffic overlays and speed adjustments if available

### Why not keep client-side Google Directions?

- key exposure
- inconsistent route behavior between app versions
- impossible to centrally cache well
- hard to add fallback logic
- hard to measure route quality across providers

## Dispatch Algorithm Recommendation

### Current behavior

Current code can find riders near a point using Mongo geospatial indexing.

This is fine as a first-pass candidate retrieval layer.

### Better design: two-stage dispatch

#### Stage 1: candidate generation

Use H3 and/or geo index to pull a bounded set of nearby riders:

- same cell
- ring 1
- ring 2
- stop when enough viable candidates are collected

Candidate filters:

- online
- available
- correct vehicle type
- not already overloaded
- fresh location update within threshold

#### Stage 2: travel-time scoring

For those candidates, compute:

- rider to store ETA
- rider to store route distance
- predicted store waiting overlap
- store to customer ETA

Example score:

`score = 0.45 * rider_to_store_eta + 0.20 * store_wait_mismatch + 0.20 * store_to_customer_eta + 0.10 * rider_load_penalty + 0.05 * reliability_penalty`

This should be configurable and learned over time.

### Important rule

Never assign the "nearest" rider purely by latitude/longitude.
Assign the best rider by expected fulfillment cost.

## ETA Model Recommendation

### ETA should not be one number from one API

For grocery delivery, ETA should be composed from multiple segments:

1. rider to store travel time
2. store prep / packing time
3. pickup handoff time
4. store to customer travel time
5. building access / drop-off buffer

### ETA architecture

#### Base ETA

Provided by routing engine.

#### Corrective ETA layer

Add learned correction terms using:

- city/zone
- hour of day
- weekday/weekend
- rain or bad weather
- store wait profile
- apartment vs house dropoff
- rider historical variance
- route class and traffic volatility

This can begin as rules and later become an ML model.

### Live ETA recalculation policy

Do not recompute on every ping.

Recompute only when:

- rider moved more than X meters
- matched road segment changed
- route deviation exceeds threshold
- traffic update invalidates current route
- fixed time window elapsed, such as 20-30 seconds

This removes expensive routing work from the websocket loop.

## Map Matching Recommendation

Map matching is essential once you have real rider movement.

Without map matching:

- rider markers jump
- route progress is noisy
- ETA drifts
- nearest-edge and turn estimation are weaker

Recommended:

- match raw rider traces to the road graph before ETA updates and progress computation
- smooth visual output separately from operational truth

Use:

- Mapbox Map Matching in the managed phase
- Valhalla trace/matching in the self-hosted phase

## Caching Strategy

### Current cache

Current cache is request-level and TTL-based.

That is useful, but not enough for scale.

### Recommended caches

#### L1 in-process cache

- small route responses
- 10-30 second TTL

#### L2 Redis cache

- matrix cell-pair durations
- route summaries
- isochrones for common store cells

### Better cache keys

Prefer cell-based cache keys instead of raw coordinates when the use case tolerates small error:

- `matrix:{profile}:{src_h3}:{dst_h3}:{time_bucket}`
- `iso:{profile}:{src_h3}:{minute_bucket}`
- `route:{profile}:{origin_snap}:{dest_snap}:{traffic_bucket}`

This greatly improves cache hit rate in store-centric delivery flows.

## Scalability Design

### Regional partitioning

Shard routing and dispatch by:

- city
- metro region
- map ID

This mirrors ideas seen in Grab and DoorDash.

### Separate hot and cold paths

Hot path:

- rider location updates
- candidate retrieval
- matrix scoring
- tracking fanout

Cold path:

- route quality analytics
- ETA model retraining
- simulator jobs
- historical reports

### Expected scaling pattern

At moderate scale:

- Location Ingestion Service horizontally scaled
- Redis cluster
- Kafka topic partitioned by city
- Routing cluster partitioned by region
- Dispatch workers per city

## Failure Handling and Fallbacks

### Routing provider failure

Fallback order:

1. cached route/matrix
2. secondary provider
3. heuristic ETA using historical cell-pair duration
4. haversine fallback only for degraded mode, never primary

### GPS quality failure

If signal is poor:

- keep last matched position for a grace period
- widen ETA confidence interval
- avoid overreacting to jitter

### Stale rider updates

Riders should be excluded from dispatch if last update exceeds threshold.

Suggested thresholds:

- active dispatch candidate: < 10 seconds
- active tracking: < 15 seconds
- mark low-confidence beyond that

## Security and Cost Controls

### Security

- never expose routing provider API keys in mobile code
- backend signs and brokers routing requests
- rate limit route and matrix endpoints by actor and order context

### Cost controls

- matrix requests must be batched
- reuse store-cell ETA caches
- avoid recompute on every rider ping
- keep managed provider as premium fallback, not always-primary at scale

## Recommended Evolution Plan

### Phase 1: immediate hardening

1. Remove client-side route fetching.
2. Add backend `RoutingService` abstraction.
3. Add `DispatchService` with two-stage rider selection.
4. Move ETA recalculation off the websocket/location update hot path into async jobs.
5. Add H3 indexing for rider and store/customer locations.

### Phase 2: operational maturity

1. Add map matching.
2. Add matrix caching by H3 cell pairs.
3. Add route quality and ETA accuracy metrics.
4. Add re-dispatch rules.
5. Add simulator for replay and load testing.

### Phase 3: advanced optimization

1. Self-host Valhalla.
2. Add learned ETA correction model.
3. Add stacked/batched delivery optimization.
4. Add demand heatmaps and predictive pre-positioning.
5. Add city-level routing shards and failover.

## Concrete Changes Recommended For This Codebase

### Backend changes

Add modules:

- `backend/src/modules/routing`
- `backend/src/modules/dispatch`
- `backend/src/modules/location-ingestion`

Move route calls out of frontend and into:

- `backend/src/modules/routing/routing.service.ts`

Refactor current ETA service so it:

- consumes routing abstraction
- consumes prep-time estimates
- is triggered asynchronously

Refactor current rider location flow so:

- `riderLocationUpdate` only validates and enqueues
- a worker performs map matching, cache updates, and ETA recompute decisions

### Frontend changes

Replace direct Google route calls with backend APIs.

The mobile client should request:

- current order tracking snapshot
- route polyline
- ETA and confidence
- last updated timestamp

### Admin changes

Add tooling for:

- live rider map
- ETA error dashboards
- provider comparison dashboards
- dispatch candidate inspection

## Metrics That Must Exist Before Calling This "Production Ready"

### Dispatch

- assignment latency p50/p95/p99
- rider acceptance rate
- redispatch rate
- unassigned order rate

### Routing

- route API latency p50/p95/p99
- matrix API latency p50/p95/p99
- cache hit rate
- provider error rate

### ETA

- ETA vs ATA absolute error
- ETA underprediction rate
- ETA overprediction rate
- error by zone, store, hour, weather

### Tracking

- rider ping freshness
- socket fanout latency
- map matching success rate
- route deviation frequency

## Final Recommendation

For this grocery platform, the best architecture is not to clone Uber literally.

The best design is:

- Uber-style service separation
- Grab-style road-network-aware nearest-rider search
- DoorDash-style asynchronous dispatch/routing and simulation discipline
- H3 for spatial indexing
- Valhalla as the long-term routing core
- managed provider fallback for resilience and traffic coverage

The most important design decision is this:

`dispatch and ETA should optimize expected fulfillment time, not straight-line nearness`

If we build around that principle, the platform will scale much better and produce much more reliable delivery experiences.

## Sources

- Karan Pratap Singh, Uber system design overview:
  - https://www.karanpratapsingh.com/blog/system-design-the-complete-course
- Uber, routing engine:
  - https://www.uber.com/en-EC/blog/engineering-routing-engine/
- Uber, H3:
  - https://www.uber.com/en-TR/blog/h3/
- Uber tech stack:
  - https://www.uber.com/en-EC/blog/tech-stack-part-one-foundation/
- Grab, Pharos nearest-driver search:
  - https://engineering.grab.com/pharos-searching-nearby-drivers-on-road-network-at-scale
- Grab, DispatchGym:
  - https://engineering.grab.com/techblog_-dispatchgym
- DoorDash, geospatial simulator:
  - https://careersatdoordash.com/blog/scaling-geospatial-innovation-with-a-location-simulator/
- DoorDash, routing optimization:
  - https://careersatdoordash.com/blog/scaling-a-routing-algorithm-using-multithreading-and-ruin-and-recreate/
- Mapbox Navigation docs:
  - https://docs.mapbox.com/api/navigation/
- Valhalla docs:
  - https://valhalla.github.io/valhalla/
- H3 docs:
  - https://h3geo.org/
