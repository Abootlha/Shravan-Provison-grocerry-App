import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentOrder: null,
    riderLocation: null,
    riderHeading: 0,
    previousRiderLocation: null,
    routeCoordinates: [],
    routeInfo: null,
    storeLocation: null,
    connectionStatus: 'disconnected',
    error: null,
    isLoading: false,
    distanceRemaining: null,
    durationRemaining: null,
    activeLeg: null,
    lastLocationUpdateAt: null,
};

const orderTrackingSlice = createSlice({
    name: 'orderTracking',
    initialState,
    reducers: {
        setCurrentOrder: (state, action) => {
            state.currentOrder = action.payload;
            state.error = null;
        },
        clearCurrentOrder: (state) => {
            state.currentOrder = null;
            state.riderLocation = null;
            state.previousRiderLocation = null;
            state.riderHeading = 0;
            state.routeCoordinates = [];
            state.routeInfo = null;
            state.storeLocation = null;
            state.error = null;
            state.distanceRemaining = null;
            state.durationRemaining = null;
            state.activeLeg = null;
            state.lastLocationUpdateAt = null;
        },
        updateOrderStatus: (state, action) => {
            if (state.currentOrder) {
                const { status, timeline, estimatedDeliveryTime, rider, order } = action.payload;

                if (order) {
                    state.currentOrder = {
                        ...state.currentOrder,
                        ...order,
                    };
                }

                if (status) {
                    state.currentOrder.orderStatus = status;
                }
                if (timeline) {
                    state.currentOrder.timeline = timeline;
                }
                if (estimatedDeliveryTime) {
                    state.currentOrder.estimatedDeliveryTime = estimatedDeliveryTime;
                }
                if (rider) {
                    state.currentOrder.rider = { ...state.currentOrder.rider, ...rider };
                    state.currentOrder.riderId = {
                        ...(typeof state.currentOrder.riderId === 'object' ? state.currentOrder.riderId : {}),
                        ...rider,
                    };
                }

                const tracking = order?.tracking || action.payload.tracking;
                if (tracking) {
                    state.activeLeg = tracking.activeLeg || state.activeLeg;
                    state.lastLocationUpdateAt = tracking.lastLocationUpdateAt || state.lastLocationUpdateAt;
                    state.routeCoordinates = tracking.routeCoordinates || state.routeCoordinates;
                    state.distanceRemaining = tracking.distanceRemaining ?? state.distanceRemaining;
                    state.durationRemaining = tracking.durationMinutes ?? state.durationRemaining;
                    if (tracking.estimatedDeliveryTime && state.currentOrder) {
                        state.currentOrder.estimatedDeliveryTime = tracking.estimatedDeliveryTime;
                    }
                    if (tracking.riderLocation) {
                        if (state.riderLocation) {
                            state.previousRiderLocation = {
                                latitude: state.riderLocation.latitude,
                                longitude: state.riderLocation.longitude,
                            };
                        }
                        state.riderLocation = {
                            latitude: tracking.riderLocation.latitude,
                            longitude: tracking.riderLocation.longitude,
                            timestamp: tracking.lastLocationUpdateAt || new Date().toISOString(),
                            heading: tracking.riderLocation.heading || null,
                            speed: tracking.riderLocation.speed || null,
                        };
                    }
                }
            }
        },

        updateRiderLocation: (state, action) => {
            if (state.riderLocation) {
                state.previousRiderLocation = {
                    latitude: state.riderLocation.latitude,
                    longitude: state.riderLocation.longitude,
                };
            }
            state.riderLocation = {
                latitude: action.payload.location.latitude,
                longitude: action.payload.location.longitude,
                timestamp: action.payload.timestamp,
                heading: action.payload.location.heading || null,
                speed: action.payload.location.speed || null,
            };
            state.lastLocationUpdateAt = action.payload.timestamp;
            if (action.payload.tracking?.routeCoordinates) {
                state.routeCoordinates = action.payload.tracking.routeCoordinates;
            }
            if (action.payload.tracking?.activeLeg) {
                state.activeLeg = action.payload.tracking.activeLeg;
            }
        },
        clearRiderLocation: (state) => {
            state.riderLocation = null;
            state.previousRiderLocation = null;
            state.riderHeading = 0;
        },

        setRiderHeading: (state, action) => {
            state.riderHeading = action.payload;
        },

        setRouteCoordinates: (state, action) => {
            state.routeCoordinates = action.payload;
        },
        setRouteInfo: (state, action) => {
            state.routeInfo = action.payload;
        },
        clearRoute: (state) => {
            state.routeCoordinates = [];
            state.routeInfo = null;
        },

        setStoreLocation: (state, action) => {
            state.storeLocation = action.payload;
        },

        updateETA: (state, action) => {
            const { estimatedDeliveryTime, durationMinutes, distanceRemaining } = action.payload;

            if (state.currentOrder && estimatedDeliveryTime) {
                state.currentOrder.estimatedDeliveryTime = estimatedDeliveryTime;
            }
            if (durationMinutes !== undefined) {
                state.durationRemaining = durationMinutes;
                if (state.currentOrder) {
                    state.currentOrder.durationMinutes = durationMinutes;
                }
            }
            if (distanceRemaining !== undefined) {
                state.distanceRemaining = distanceRemaining;
                if (state.currentOrder) {
                    state.currentOrder.distanceRemaining = distanceRemaining;
                }
            }
            if (action.payload.tracking?.routeCoordinates) {
                state.routeCoordinates = action.payload.tracking.routeCoordinates;
            }
            if (action.payload.tracking?.activeLeg) {
                state.activeLeg = action.payload.tracking.activeLeg;
            }
        },

        setConnectionStatus: (state, action) => {
            state.connectionStatus = action.payload;
        },

        setLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
            state.isLoading = false;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
});

export const {
    setCurrentOrder,
    clearCurrentOrder,
    updateOrderStatus,
    updateRiderLocation,
    clearRiderLocation,
    setRiderHeading,
    setRouteCoordinates,
    setRouteInfo,
    clearRoute,
    setStoreLocation,
    updateETA,
    setConnectionStatus,
    setLoading,
    setError,
    clearError,
} = orderTrackingSlice.actions;

export default orderTrackingSlice.reducer;
