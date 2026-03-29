import { io } from 'socket.io-client';
import socketService from './socketService';
import { store } from '../store';
import {
    setConnectionStatus,
    updateOrderStatus,
    updateRiderLocation,
    updateETA,
    setError,
} from '../store/slices/orderTrackingSlice';

// Mock react-native Platform
jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
    },
}));

// Mock the store dispatch
jest.mock('../store', () => ({
    store: {
        dispatch: jest.fn(),
    },
}));

// Mock socket.io-client
jest.mock('socket.io-client');

describe('SocketService', () => {
    let mockSocket;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create a mock socket instance
        mockSocket = {
            on: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn(),
            connected: false,
            id: 'mock-socket-id',
        };

        // Mock io to return our mock socket
        io.mockReturnValue(mockSocket);

        // Reset socket service state
        socketService.socket = null;
        socketService.currentOrderId = null;
        socketService.reconnectAttempts = 0;
    });

    describe('connect', () => {
        it('should create socket connection with JWT token', () => {
            const token = 'test-jwt-token';

            socketService.connect(token);

            expect(io).toHaveBeenCalledWith(
                expect.stringContaining('/tracking'),
                expect.objectContaining({
                    auth: { token },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                })
            );
            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('connecting'));
        });

        it('should not create new connection if already connected', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;

            socketService.connect('token');

            expect(io).not.toHaveBeenCalled();
        });

        it('should setup event listeners on connect', () => {
            socketService.connect('token');

            expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('reconnect_failed', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('orderStatusUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('riderLocationUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('etaUpdate', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });

    describe('reconnection behavior', () => {
        it('should dispatch connected status on successful connection', () => {
            socketService.connect('token');

            // Get the connect event handler
            const connectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect'
            )[1];

            // Simulate connection
            mockSocket.connected = true;
            connectHandler();

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('connected'));
        });

        it('should re-join order room after reconnection', () => {
            const orderId = 'test-order-123';
            socketService.currentOrderId = orderId;
            socketService.connect('token');

            // Get the connect event handler
            const connectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect'
            )[1];

            // Simulate connection
            mockSocket.connected = true;
            connectHandler();

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'joinOrderRoom',
                { orderId },
                expect.any(Function)
            );
        });

        it('should dispatch reconnecting status on reconnect attempt', () => {
            socketService.connect('token');

            // Get the reconnect_attempt event handler
            const reconnectAttemptHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'reconnect_attempt'
            )[1];

            // Simulate reconnection attempt
            reconnectAttemptHandler(1);

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('reconnecting'));
        });

        it('should dispatch connected status after successful reconnection', () => {
            socketService.connect('token');

            // Get the reconnect event handler
            const reconnectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'reconnect'
            )[1];

            // Simulate successful reconnection
            reconnectHandler(3);

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('connected'));
        });

        it('should dispatch error after max reconnection attempts', () => {
            socketService.connect('token');

            // Get the connect_error event handler
            const connectErrorHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect_error'
            )[1];

            // Simulate multiple connection errors
            for (let i = 0; i < 5; i++) {
                connectErrorHandler(new Error('Connection failed'));
            }

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('disconnected'));
            expect(store.dispatch).toHaveBeenCalledWith(
                setError('Failed to connect to tracking server')
            );
        });

        it('should dispatch reconnecting status before max attempts', () => {
            socketService.connect('token');

            // Get the connect_error event handler
            const connectErrorHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect_error'
            )[1];

            // Simulate connection error
            connectErrorHandler(new Error('Connection failed'));

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('reconnecting'));
        });

        it('should dispatch error on reconnection failure', () => {
            socketService.connect('token');

            // Get the reconnect_failed event handler
            const reconnectFailedHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'reconnect_failed'
            )[1];

            // Simulate reconnection failure
            reconnectFailedHandler();

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('disconnected'));
            expect(store.dispatch).toHaveBeenCalledWith(
                setError('Failed to reconnect to tracking server')
            );
        });

        it('should reset reconnect attempts on successful connection', () => {
            socketService.connect('token');
            socketService.reconnectAttempts = 3;

            // Get the connect event handler
            const connectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect'
            )[1];

            // Simulate connection
            mockSocket.connected = true;
            connectHandler();

            expect(socketService.reconnectAttempts).toBe(0);
        });
    });

    describe('event handling', () => {
        it('should dispatch order status update on orderStatusUpdate event', () => {
            socketService.connect('token');

            // Get the orderStatusUpdate event handler
            const orderStatusHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'orderStatusUpdate'
            )[1];

            const updateData = {
                status: 'OUT_FOR_DELIVERY',
                timeline: [{ status: 'OUT_FOR_DELIVERY', timestamp: '2024-01-01' }],
                estimatedDeliveryTime: '2024-01-01T10:30:00Z',
            };

            // Simulate event
            orderStatusHandler(updateData);

            expect(store.dispatch).toHaveBeenCalledWith(
                updateOrderStatus({
                    status: updateData.status,
                    timeline: updateData.timeline,
                    estimatedDeliveryTime: updateData.estimatedDeliveryTime,
                })
            );
        });

        it('should dispatch rider location update on riderLocationUpdate event', () => {
            socketService.connect('token');

            // Get the riderLocationUpdate event handler
            const locationHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'riderLocationUpdate'
            )[1];

            const locationData = {
                location: { latitude: 19.076, longitude: 72.8777 },
                timestamp: '2024-01-01T10:00:00Z',
            };

            // Simulate event
            locationHandler(locationData);

            expect(store.dispatch).toHaveBeenCalledWith(
                updateRiderLocation({
                    location: locationData.location,
                    timestamp: locationData.timestamp,
                })
            );
        });

        it('should dispatch ETA update on etaUpdate event', () => {
            socketService.connect('token');

            // Get the etaUpdate event handler
            const etaHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'etaUpdate'
            )[1];

            const etaData = {
                estimatedDeliveryTime: '2024-01-01T10:30:00Z',
                durationMinutes: 15,
            };

            // Simulate event
            etaHandler(etaData);

            expect(store.dispatch).toHaveBeenCalledWith(
                updateETA({
                    estimatedDeliveryTime: etaData.estimatedDeliveryTime,
                    durationMinutes: etaData.durationMinutes,
                })
            );
        });

        it('should dispatch error on socket error event', () => {
            socketService.connect('token');

            // Get the error event handler
            const errorHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'error'
            )[1];

            const errorData = { message: 'Socket error occurred' };

            // Simulate event
            errorHandler(errorData);

            expect(store.dispatch).toHaveBeenCalledWith(setError(errorData.message));
        });
    });

    describe('joinOrderRoom', () => {
        it('should emit joinOrderRoom event when connected', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;

            const orderId = 'test-order-123';
            socketService.joinOrderRoom(orderId);

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'joinOrderRoom',
                { orderId },
                expect.any(Function)
            );
            expect(socketService.currentOrderId).toBe(orderId);
        });

        it('should not emit when socket is not connected', () => {
            mockSocket.connected = false;
            socketService.socket = mockSocket;

            socketService.joinOrderRoom('test-order-123');

            expect(mockSocket.emit).not.toHaveBeenCalled();
        });

        it('should handle join room error response', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;

            socketService.joinOrderRoom('test-order-123');

            // Get the callback function
            const callback = mockSocket.emit.mock.calls[0][2];

            // Simulate error response
            callback({ error: 'Unauthorized' });

            expect(store.dispatch).toHaveBeenCalledWith(setError('Unauthorized'));
        });
    });

    describe('leaveOrderRoom', () => {
        it('should emit leaveOrderRoom event when connected', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;
            socketService.currentOrderId = 'test-order-123';

            socketService.leaveOrderRoom('test-order-123');

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'leaveOrderRoom',
                { orderId: 'test-order-123' },
                expect.any(Function)
            );
        });

        it('should clear currentOrderId after leaving', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;
            socketService.currentOrderId = 'test-order-123';

            socketService.leaveOrderRoom('test-order-123');

            // Get the callback function
            const callback = mockSocket.emit.mock.calls[0][2];

            // Simulate success response
            callback({});

            expect(socketService.currentOrderId).toBeNull();
        });

        it('should not emit when socket is not connected', () => {
            mockSocket.connected = false;
            socketService.socket = mockSocket;

            socketService.leaveOrderRoom('test-order-123');

            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
    });

    describe('disconnect', () => {
        it('should leave order room before disconnecting', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;
            socketService.currentOrderId = 'test-order-123';

            socketService.disconnect();

            expect(mockSocket.emit).toHaveBeenCalledWith(
                'leaveOrderRoom',
                { orderId: 'test-order-123' },
                expect.any(Function)
            );
            expect(mockSocket.disconnect).toHaveBeenCalled();
        });

        it('should reset socket service state', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;
            socketService.currentOrderId = 'test-order-123';
            socketService.reconnectAttempts = 3;

            socketService.disconnect();

            expect(socketService.socket).toBeNull();
            expect(socketService.currentOrderId).toBeNull();
            expect(socketService.reconnectAttempts).toBe(0);
        });

        it('should dispatch disconnected status', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;

            socketService.disconnect();

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('disconnected'));
        });
    });

    describe('isConnected', () => {
        it('should return true when socket is connected', () => {
            mockSocket.connected = true;
            socketService.socket = mockSocket;

            expect(socketService.isConnected()).toBe(true);
        });

        it('should return false when socket is not connected', () => {
            mockSocket.connected = false;
            socketService.socket = mockSocket;

            expect(socketService.isConnected()).toBe(false);
        });

        it('should return false when socket is null', () => {
            socketService.socket = null;

            expect(socketService.isConnected()).toBe(false);
        });
    });

    describe('complete reconnection flow', () => {
        it('should handle full reconnection cycle', () => {
            const orderId = 'test-order-123';
            socketService.connect('token');
            socketService.currentOrderId = orderId;

            // Simulate initial connection
            const connectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'connect'
            )[1];
            mockSocket.connected = true;
            connectHandler();

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('connected'));

            // Simulate disconnection
            const disconnectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'disconnect'
            )[1];
            mockSocket.connected = false;
            disconnectHandler('transport close');

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('disconnected'));

            // Simulate reconnection attempt
            const reconnectAttemptHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'reconnect_attempt'
            )[1];
            reconnectAttemptHandler(1);

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('reconnecting'));

            // Simulate successful reconnection
            const reconnectHandler = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'reconnect'
            )[1];
            mockSocket.connected = true;
            reconnectHandler(1);

            expect(store.dispatch).toHaveBeenCalledWith(setConnectionStatus('connected'));

            // Verify order room was re-joined
            connectHandler();
            expect(mockSocket.emit).toHaveBeenCalledWith(
                'joinOrderRoom',
                { orderId },
                expect.any(Function)
            );
        });
    });
});
