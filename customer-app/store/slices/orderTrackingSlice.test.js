import orderTrackingReducer, {
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
} from './orderTrackingSlice';

describe('orderTrackingSlice', () => {
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
    };

    describe('initial state', () => {
        it('should return the initial state', () => {
            expect(orderTrackingReducer(undefined, { type: 'unknown' })).toEqual(initialState);
        });
    });

    describe('setCurrentOrder', () => {
        it('should set the current order', () => {
            const order = {
                _id: '123',
                status: 'PENDING',
                totalAmount: 100,
            };
            const actual = orderTrackingReducer(initialState, setCurrentOrder(order));
            expect(actual.currentOrder).toEqual(order);
            expect(actual.error).toBeNull();
        });
    });

    describe('clearCurrentOrder', () => {
        it('should clear the current order and rider location', () => {
            const stateWithOrder = {
                ...initialState,
                currentOrder: { _id: '123' },
                riderLocation: { latitude: 10, longitude: 20 },
                previousRiderLocation: { latitude: 9, longitude: 19 },
                riderHeading: 45,
                routeCoordinates: [{ latitude: 10, longitude: 20 }],
                routeInfo: { distance: '1 km' },
                storeLocation: { latitude: 26, longitude: 83 },
                error: 'Some error',
            };
            const actual = orderTrackingReducer(stateWithOrder, clearCurrentOrder());
            expect(actual.currentOrder).toBeNull();
            expect(actual.riderLocation).toBeNull();
            expect(actual.previousRiderLocation).toBeNull();
            expect(actual.riderHeading).toBe(0);
            expect(actual.routeCoordinates).toEqual([]);
            expect(actual.routeInfo).toBeNull();
            expect(actual.storeLocation).toBeNull();
            expect(actual.error).toBeNull();
        });
    });

    describe('updateOrderStatus', () => {
        it('should update order status when order exists', () => {
            const stateWithOrder = {
                ...initialState,
                currentOrder: {
                    _id: '123',
                    status: 'PENDING',
                    timeline: [],
                },
            };
            const update = {
                status: 'CONFIRMED',
                timeline: [{ status: 'CONFIRMED', timestamp: new Date().toISOString() }],
                estimatedDeliveryTime: new Date().toISOString(),
            };
            const actual = orderTrackingReducer(stateWithOrder, updateOrderStatus(update));
            expect(actual.currentOrder.status).toBe('CONFIRMED');
            expect(actual.currentOrder.timeline).toEqual(update.timeline);
            expect(actual.currentOrder.estimatedDeliveryTime).toBe(update.estimatedDeliveryTime);
        });

        it('should not crash when order is null', () => {
            const actual = orderTrackingReducer(
                initialState,
                updateOrderStatus({ status: 'CONFIRMED' })
            );
            expect(actual.currentOrder).toBeNull();
        });

        it('should update only status when timeline is not provided', () => {
            const stateWithOrder = {
                ...initialState,
                currentOrder: {
                    _id: '123',
                    status: 'PENDING',
                    timeline: [{ status: 'PENDING', timestamp: '2024-01-01' }],
                },
            };
            const actual = orderTrackingReducer(
                stateWithOrder,
                updateOrderStatus({ status: 'CONFIRMED' })
            );
            expect(actual.currentOrder.status).toBe('CONFIRMED');
            expect(actual.currentOrder.timeline).toEqual([
                { status: 'PENDING', timestamp: '2024-01-01' },
            ]);
        });
    });

    describe('updateRiderLocation', () => {
        it('should update rider location with timestamp', () => {
            const location = {
                location: { latitude: 19.076, longitude: 72.8777 },
                timestamp: new Date().toISOString(),
            };
            const actual = orderTrackingReducer(initialState, updateRiderLocation(location));
            expect(actual.riderLocation).toEqual({
                latitude: location.location.latitude,
                longitude: location.location.longitude,
                timestamp: location.timestamp,
            });
        });
    });

    describe('clearRiderLocation', () => {
        it('should clear rider location', () => {
            const stateWithLocation = {
                ...initialState,
                riderLocation: { latitude: 10, longitude: 20, timestamp: '2024-01-01' },
            };
            const actual = orderTrackingReducer(stateWithLocation, clearRiderLocation());
            expect(actual.riderLocation).toBeNull();
        });
    });

    describe('updateETA', () => {
        it('should update ETA when order exists', () => {
            const stateWithOrder = {
                ...initialState,
                currentOrder: {
                    _id: '123',
                    status: 'OUT_FOR_DELIVERY',
                },
            };
            const eta = {
                estimatedDeliveryTime: new Date().toISOString(),
                durationMinutes: 15,
            };
            const actual = orderTrackingReducer(stateWithOrder, updateETA(eta));
            expect(actual.currentOrder.estimatedDeliveryTime).toBe(eta.estimatedDeliveryTime);
            expect(actual.currentOrder.durationMinutes).toBe(eta.durationMinutes);
        });

        it('should not crash when order is null', () => {
            const eta = {
                estimatedDeliveryTime: new Date().toISOString(),
                durationMinutes: 15,
            };
            const actual = orderTrackingReducer(initialState, updateETA(eta));
            expect(actual.currentOrder).toBeNull();
        });
    });

    describe('setConnectionStatus', () => {
        it('should update connection status', () => {
            const actual = orderTrackingReducer(initialState, setConnectionStatus('connected'));
            expect(actual.connectionStatus).toBe('connected');
        });

        it('should handle all connection statuses', () => {
            const statuses = ['disconnected', 'connecting', 'connected', 'reconnecting'];
            statuses.forEach((status) => {
                const actual = orderTrackingReducer(initialState, setConnectionStatus(status));
                expect(actual.connectionStatus).toBe(status);
            });
        });
    });

    describe('setLoading', () => {
        it('should set loading state', () => {
            const actual = orderTrackingReducer(initialState, setLoading(true));
            expect(actual.isLoading).toBe(true);
        });
    });

    describe('setError', () => {
        it('should set error and clear loading', () => {
            const stateWithLoading = { ...initialState, isLoading: true };
            const actual = orderTrackingReducer(
                stateWithLoading,
                setError('Connection failed')
            );
            expect(actual.error).toBe('Connection failed');
            expect(actual.isLoading).toBe(false);
        });
    });

    describe('clearError', () => {
        it('should clear error', () => {
            const stateWithError = { ...initialState, error: 'Some error' };
            const actual = orderTrackingReducer(stateWithError, clearError());
            expect(actual.error).toBeNull();
        });
    });

    describe('real-time update scenarios', () => {
        it('should handle complete order tracking flow', () => {
            let state = initialState;

            // Set initial order
            state = orderTrackingReducer(
                state,
                setCurrentOrder({
                    _id: '123',
                    status: 'PENDING',
                    timeline: [],
                })
            );
            expect(state.currentOrder.status).toBe('PENDING');

            // Update to CONFIRMED
            state = orderTrackingReducer(
                state,
                updateOrderStatus({
                    status: 'CONFIRMED',
                    timeline: [{ status: 'CONFIRMED', timestamp: '2024-01-01' }],
                })
            );
            expect(state.currentOrder.status).toBe('CONFIRMED');

            // Update to OUT_FOR_DELIVERY with rider location
            state = orderTrackingReducer(
                state,
                updateOrderStatus({ status: 'OUT_FOR_DELIVERY' })
            );
            state = orderTrackingReducer(
                state,
                updateRiderLocation({
                    location: { latitude: 19.076, longitude: 72.8777 },
                    timestamp: '2024-01-01T10:00:00Z',
                })
            );
            expect(state.currentOrder.status).toBe('OUT_FOR_DELIVERY');
            expect(state.riderLocation).toBeTruthy();

            // Update ETA
            state = orderTrackingReducer(
                state,
                updateETA({
                    estimatedDeliveryTime: '2024-01-01T10:15:00Z',
                    durationMinutes: 15,
                })
            );
            expect(state.currentOrder.estimatedDeliveryTime).toBe('2024-01-01T10:15:00Z');

            // Clear on unmount
            state = orderTrackingReducer(state, clearCurrentOrder());
            expect(state.currentOrder).toBeNull();
            expect(state.riderLocation).toBeNull();
        });

        it('should handle connection status changes during tracking', () => {
            let state = initialState;

            state = orderTrackingReducer(state, setConnectionStatus('connecting'));
            expect(state.connectionStatus).toBe('connecting');

            state = orderTrackingReducer(state, setConnectionStatus('connected'));
            expect(state.connectionStatus).toBe('connected');

            state = orderTrackingReducer(state, setConnectionStatus('reconnecting'));
            expect(state.connectionStatus).toBe('reconnecting');

            state = orderTrackingReducer(state, setConnectionStatus('connected'));
            expect(state.connectionStatus).toBe('connected');
        });
    });
});
