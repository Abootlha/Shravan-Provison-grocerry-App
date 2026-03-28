import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentOrder: null,
    riderLocation: null,
    riderHeading: 0,
    previousRiderLocation: null,
    routeCoordinates: [],
    routeInfo: null, // { distance, duration, durationValue, distanceValue }
    storeLocation: null, // { latitude, longitude }
    connectionStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'reconnecting'
    error: null,
    isLoading: false,
};

const orderTrackingSlice = createSlice({
    name: 'orderTracking',
    initialState,
    reducers: {
        // Order management
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
        },
        updateOrderStatus: (state, action) => {
            if (state.currentOrder) {
                state.currentOrder.orderStatus = action.payload.status || action.payload.orderStatus;
                if (action.payload.timeline) {
                    state.currentOrder.timeline = action.payload.timeline;
                }
                if (action.payload.estimatedDeliveryTime) {
                    state.currentOrder.estimatedDeliveryTime = action.payload.estimatedDeliveryTime;
                }
            }
        },

        // Rider location updates
        updateRiderLocation: (state, action) => {
            // Store the previous location for bearing calculation
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
            };
        },
        clearRiderLocation: (state) => {
            state.riderLocation = null;
            state.previousRiderLocation = null;
            state.riderHeading = 0;
        },

        // Rider heading (bearing)
        setRiderHeading: (state, action) => {
            state.riderHeading = action.payload;
        },

        // Route data
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

        // Store location
        setStoreLocation: (state, action) => {
            state.storeLocation = action.payload;
        },

        // ETA updates
        updateETA: (state, action) => {
            if (state.currentOrder) {
                state.currentOrder.estimatedDeliveryTime = action.payload.estimatedDeliveryTime;
                state.currentOrder.durationMinutes = action.payload.durationMinutes;
            }
        },

        // Connection status
        setConnectionStatus: (state, action) => {
            state.connectionStatus = action.payload;
        },

        // Loading and error states
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
