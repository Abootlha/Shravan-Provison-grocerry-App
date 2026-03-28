import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import RiderTrackingMap from './RiderTrackingMap';
import {
    Clock, Package, Truck, CheckCircle, XCircle, RefreshCw, Search,
    MapPin, User, Phone, Eye, X, ChevronLeft, ChevronRight, Map
} from 'lucide-react';

interface TimelineEntry {
    status: string;
    timestamp: string;
    changedBy: string;
}

interface Order {
    _id: string;
    orderId: string;
    userId: { _id: string; name: string; phone: string };
    items: { productId: { name: string }; name: string; quantity: number; price: number }[];
    totalAmount: number;
    orderStatus: string;
    createdAt: string;
    deliveryAddress?: {
        type: string;
        address: string;
        city: string;
        pincode: string;
        coordinates: { type: string; coordinates: [number, number] };
    };
    riderId?: { _id: string; name: string; phone: string };
    timeline?: TimelineEntry[];
    estimatedDeliveryTime?: string;
}

interface Rider {
    _id: string;
    name: string;
    phone: string;
    isAvailable: boolean;
    isOnline: boolean;
    currentLocation?: {
        type: string;
        coordinates: [number, number];
    };
}

interface RiderLocation {
    riderId: string;
    riderName: string;
    latitude: number;
    longitude: number;
    timestamp: Date;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: '#3B82F6', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
    CONFIRMED: { color: '#8B5CF6', icon: <CheckCircle className="w-4 h-4" />, label: 'Confirmed' },
    PACKED: { color: '#F97316', icon: <Package className="w-4 h-4" />, label: 'Packed' },
    ASSIGNED: { color: '#E6A23C', icon: <User className="w-4 h-4" />, label: 'Assigned' },
    OUT_FOR_DELIVERY: { color: '#10B981', icon: <Truck className="w-4 h-4" />, label: 'Out for Delivery' },
    DELIVERED: { color: '#22C55E', icon: <CheckCircle className="w-4 h-4" />, label: 'Delivered' },
    CANCELLED: { color: '#EF4444', icon: <XCircle className="w-4 h-4" />, label: 'Cancelled' },
};

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY'];

export default function OrderTrackingManager() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [riderLocations, setRiderLocations] = useState<RiderLocation[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'reconnecting'>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    useEffect(() => {
        fetchOrders();
        fetchRiders();
        initializeSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    const initializeSocket = () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        setConnectionStatus('connecting');

        const socket = io(import.meta.env.PUBLIC_TRACKING_SERVICE_URL || 'http://localhost:3000', {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: maxReconnectAttempts,
        });

        socket.on('connect', () => {
            console.log('Socket connected');
            setConnectionStatus('connected');
            setError(null);
            reconnectAttempts.current = 0;
            
            // Join rooms for all active orders
            orders.forEach(order => {
                if (ACTIVE_STATUSES.includes(order.orderStatus)) {
                    socket.emit('joinOrderRoom', { orderId: order._id });
                }
            });
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            reconnectAttempts.current++;
            
            if (reconnectAttempts.current >= maxReconnectAttempts) {
                setConnectionStatus('disconnected');
                setError('Failed to connect to tracking server. Please refresh the page.');
            } else {
                setConnectionStatus('reconnecting');
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            setConnectionStatus('connected');
            setError(null);
            reconnectAttempts.current = 0;
        });

        socket.on('reconnect_attempt', () => {
            console.log('Socket reconnection attempt:', reconnectAttempts.current + 1);
            setConnectionStatus('reconnecting');
        });

        socket.on('reconnect_failed', () => {
            console.error('Socket reconnection failed');
            setConnectionStatus('disconnected');
            setError('Failed to reconnect to tracking server. Please refresh the page.');
        });

        socket.on('orderStatusUpdate', (data: any) => {
            console.log('Order status update:', data);
            setOrders(prev => prev.map(order =>
                order._id === data.orderId
                    ? { ...order, orderStatus: data.status, timeline: data.timeline, estimatedDeliveryTime: data.estimatedDeliveryTime }
                    : order
            ));
            if (selectedOrder?._id === data.orderId) {
                setSelectedOrder(prev => prev ? { ...prev, orderStatus: data.status, timeline: data.timeline } : null);
            }
        });

        socket.on('riderLocationUpdate', (data: any) => {
            console.log('Rider location update:', data);
            // Update rider locations for map
            setRiderLocations(prev => {
                const existing = prev.find(r => r.riderId === data.riderId);
                if (existing) {
                    return prev.map(r =>
                        r.riderId === data.riderId
                            ? { ...r, latitude: data.location.latitude, longitude: data.location.longitude, timestamp: new Date(data.timestamp) }
                            : r
                    );
                } else {
                    // Find rider name from riders list
                    const rider = riders.find(r => r._id === data.riderId);
                    return [...prev, {
                        riderId: data.riderId,
                        riderName: rider?.name || 'Unknown Rider',
                        latitude: data.location.latitude,
                        longitude: data.location.longitude,
                        timestamp: new Date(data.timestamp)
                    }];
                }
            });
        });

        socket.on('etaUpdate', (data: any) => {
            console.log('ETA update:', data);
            setOrders(prev => prev.map(order =>
                order._id === data.orderId
                    ? { ...order, estimatedDeliveryTime: data.estimatedDeliveryTime }
                    : order
            ));
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setConnectionStatus('disconnected');
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
            setError(err.message || 'Socket error occurred');
        });

        socketRef.current = socket;
    };

    async function fetchOrders() {
        try {
            setError(null);
            const data = await api.getOrders({ page, status: statusFilter || undefined });
            setOrders(data.orders || []);
            setTotalPages(data.pagination?.pages || 1);

            // Join socket rooms for active orders
            if (socketRef.current?.connected) {
                data.orders?.forEach((order: Order) => {
                    if (ACTIVE_STATUSES.includes(order.orderStatus)) {
                        socketRef.current?.emit('joinOrderRoom', { orderId: order._id });
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setError('Failed to fetch orders. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    async function fetchRiders() {
        try {
            setError(null);
            // Fetch available riders from backend
            const response = await api.getAvailableRiders();
            setRiders(response.riders || []);
            
            // Initialize rider locations from current location data
            const locations: RiderLocation[] = response.riders
                .filter((r: Rider) => r.currentLocation && r.currentLocation.coordinates)
                .map((r: Rider) => ({
                    riderId: r._id,
                    riderName: r.name,
                    latitude: r.currentLocation!.coordinates[1], // GeoJSON is [lng, lat]
                    longitude: r.currentLocation!.coordinates[0],
                    timestamp: new Date()
                }));
            setRiderLocations(locations);
        } catch (error) {
            console.error('Error fetching riders:', error);
            setError('Failed to fetch riders. Please try again.');
        }
    }

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
        fetchRiders();
    };

    async function updateStatus(orderId: string, newStatus: string) {
        try {
            setError(null);
            await api.updateOrderStatus(orderId, newStatus);
            fetchOrders();
            if (selectedOrder?._id === orderId) {
                setSelectedOrder({ ...selectedOrder, orderStatus: newStatus });
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Error updating status';
            setError(errorMessage);
            console.error('Error updating status:', error);
        }
    }

    async function assignRider(orderId: string, riderId: string) {
        try {
            setError(null);
            await api.assignRider(orderId, riderId);
            fetchOrders();
            if (selectedOrder?._id === orderId) {
                const rider = riders.find(r => r._id === riderId);
                if (rider) {
                    setSelectedOrder({ ...selectedOrder, riderId: rider as any });
                }
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Error assigning rider';
            setError(errorMessage);
            console.error('Error assigning rider:', error);
        }
    }

    const filteredOrders = orders.filter(o =>
        o.orderId.toLowerCase().includes(search.toLowerCase()) ||
        o.userId?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const statusCounts = orders.reduce((acc, order) => {
        acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <Skeleton className="h-12 w-64" />
                    <div className="flex gap-2">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-28 rounded-full" />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-bg min-h-screen">
            <div className="relative z-10 p-6 lg:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Order Tracking
                            </h1>
                            {/* Connection Status Indicator */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium" style={{
                                background: connectionStatus === 'connected' ? '#22C55E20' : 
                                           connectionStatus === 'reconnecting' ? '#F9731620' : 
                                           connectionStatus === 'connecting' ? '#3B82F620' : '#EF444420',
                                color: connectionStatus === 'connected' ? '#22C55E' : 
                                       connectionStatus === 'reconnecting' ? '#F97316' : 
                                       connectionStatus === 'connecting' ? '#3B82F6' : '#EF4444'
                            }}>
                                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'reconnecting' || connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} style={{
                                    background: connectionStatus === 'connected' ? '#22C55E' : 
                                               connectionStatus === 'reconnecting' ? '#F97316' : 
                                               connectionStatus === 'connecting' ? '#3B82F6' : '#EF4444'
                                }} />
                                {connectionStatus === 'connected' ? 'Live' : 
                                 connectionStatus === 'reconnecting' ? 'Reconnecting...' : 
                                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                            </div>
                        </div>
                        <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                            Real-time order management and tracking
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setShowMap(!showMap)}>
                            <Map className="w-4 h-4 mr-2" />
                            {showMap ? 'Hide Map' : 'Show Map'}
                        </Button>
                        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ 
                        background: '#FEE2E2', 
                        border: '1px solid #FCA5A5',
                        color: '#991B1B'
                    }}>
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="flex-1 text-sm font-medium">{error}</p>
                        <button 
                            onClick={() => setError(null)}
                            className="p-1 rounded-lg hover:bg-red-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Live Rider Map */}
                {showMap && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Live Rider Locations
                        </h2>
                        <RiderTrackingMap riders={riderLocations} />
                    </div>
                )}

                {/* Status Filter Pills */}
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => { setStatusFilter(''); setPage(1); }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{
                            background: !statusFilter ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: !statusFilter ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            border: '1px solid ' + (!statusFilter ? 'var(--accent)' : 'var(--border)')
                        }}
                    >
                        All ({orders.length})
                    </button>
                    {ACTIVE_STATUSES.map((status) => {
                        const config = STATUS_CONFIG[status];
                        const isActive = statusFilter === status;
                        return (
                            <button
                                key={status}
                                onClick={() => { setStatusFilter(status); setPage(1); }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                                style={{
                                    background: isActive ? config.color + '20' : 'var(--bg-tertiary)',
                                    color: isActive ? config.color : 'var(--text-secondary)',
                                    border: `1px solid ${isActive ? config.color : 'var(--border)'}`,
                                }}
                            >
                                {config.icon}
                                {config.label}
                                {statusCounts[status] ? <span className="ml-1">({statusCounts[status]})</span> : null}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                        placeholder="Search by order ID or customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11"
                    />
                </div>

                {/* Orders Table */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                    {filteredOrders.length === 0 ? (
                        <EmptyState type="orders" />
                    ) : (
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Rider</th>
                                    <th>ETA</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => {
                                    const config = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PENDING;
                                    return (
                                        <tr key={order._id}>
                                            <td>
                                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {order.orderId}
                                                </span>
                                            </td>
                                            <td>
                                                <div>
                                                    <div>{order.userId?.name || 'Guest'}</div>
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        {order.userId?.phone}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{order.items?.length || 0} items</td>
                                            <td>
                                                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                                                    ₹{order.totalAmount}
                                                </span>
                                            </td>
                                            <td>
                                                <Badge
                                                    className="inline-flex items-center gap-1.5"
                                                    style={{ background: config.color + '20', color: config.color }}
                                                >
                                                    {config.icon}
                                                    {config.label}
                                                </Badge>
                                            </td>
                                            <td>
                                                {order.riderId ? (
                                                    <div className="text-sm">
                                                        {order.riderId.name}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        Not assigned
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {order.estimatedDeliveryTime ? (
                                                    <div className="text-sm">
                                                        {new Date(order.estimatedDeliveryTime).toLocaleTimeString('en-IN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-2 rounded-lg transition-colors"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    aria-label="View"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>

                {/* Order Detail Drawer */}
                {selectedOrder && (
                    <div
                        className="fixed inset-0 z-50 flex justify-end"
                        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setSelectedOrder(null)}
                    >
                        <div
                            className="w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-slide-in-right"
                            style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                className="sticky top-0 px-6 py-5 flex items-center justify-between z-10"
                                style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
                            >
                                <div>
                                    <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        Order {selectedOrder.orderId}
                                    </h2>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Timeline */}
                                {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
                                    <div
                                        className="p-4 rounded-xl"
                                        style={{ background: 'var(--bg-tertiary)' }}
                                    >
                                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                            Order Timeline
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedOrder.timeline.map((entry, index) => {
                                                const config = STATUS_CONFIG[entry.status];
                                                return (
                                                    <div key={index} className="flex items-start gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                                            style={{ background: config?.color + '20', color: config?.color }}
                                                        >
                                                            {config?.icon}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                {config?.label || entry.status}
                                                            </div>
                                                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                {new Date(entry.timestamp).toLocaleString('en-IN')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Status Change Controls */}
                                {selectedOrder.orderStatus !== 'DELIVERED' && selectedOrder.orderStatus !== 'CANCELLED' && (
                                    <div aria-label="Update Status Section">
                                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                            Update Status
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.keys(STATUS_CONFIG)
                                                .filter(s => s !== selectedOrder.orderStatus)
                                                .map((status) => {
                                                    const config = STATUS_CONFIG[status];
                                                    return (
                                                        <Button
                                                            key={status}
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => updateStatus(selectedOrder._id, status)}
                                                            style={{
                                                                borderColor: status === 'CANCELLED' ? 'var(--danger)' : 'var(--border)',
                                                                color: status === 'CANCELLED' ? 'var(--danger)' : 'var(--text-secondary)'
                                                            }}
                                                            aria-label={`Update status to ${config?.label || status}`}
                                                        >
                                                            {config?.icon}
                                                            <span className="ml-1.5">{config?.label || status}</span>
                                                        </Button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Rider Assignment */}
                                {!selectedOrder.riderId && selectedOrder.orderStatus !== 'DELIVERED' && selectedOrder.orderStatus !== 'CANCELLED' && (
                                    <div>
                                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                            Assign Rider
                                        </h3>
                                        <div className="space-y-2">
                                            {riders.length === 0 ? (
                                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                    No available riders
                                                </p>
                                            ) : (
                                                riders.map((rider) => (
                                                    <button
                                                        key={rider._id}
                                                        onClick={() => assignRider(selectedOrder._id, rider._id)}
                                                        className="w-full p-3 rounded-lg text-left transition-colors"
                                                        style={{
                                                            background: 'var(--bg-elevated)',
                                                            border: '1px solid var(--border)'
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                    {rider.name}
                                                                </div>
                                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                    {rider.phone}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    className="text-xs"
                                                                    style={{
                                                                        background: rider.isOnline ? '#22C55E20' : '#EF444420',
                                                                        color: rider.isOnline ? '#22C55E' : '#EF4444'
                                                                    }}
                                                                >
                                                                    {rider.isOnline ? 'Online' : 'Offline'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Customer Info */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                        Customer Details
                                    </h3>
                                    <div
                                        className="p-4 rounded-xl space-y-3"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                                    >
                                        <div className="flex items-center gap-3 text-sm">
                                            <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{selectedOrder.userId?.name || 'Guest'}</span>
                                        </div>
                                        {selectedOrder.userId?.phone && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <Phone className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ color: 'var(--text-primary)' }}>{selectedOrder.userId.phone}</span>
                                            </div>
                                        )}
                                        {selectedOrder.deliveryAddress && (
                                            <div className="flex items-center gap-3 text-sm">
                                                <MapPin className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ color: 'var(--text-primary)' }}>
                                                    {[
                                                        selectedOrder.deliveryAddress.address,
                                                        selectedOrder.deliveryAddress.city,
                                                        selectedOrder.deliveryAddress.pincode
                                                    ].filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                        Order Items
                                    </h3>
                                    <div
                                        className="rounded-xl overflow-hidden"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                                    >
                                        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                            {selectedOrder.items?.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-11 h-11 rounded-xl flex items-center justify-center"
                                                            style={{ background: 'var(--bg-elevated)' }}
                                                        >
                                                            <Package className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                {item.productId?.name || item.name || 'Product'}
                                                            </p>
                                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Qty: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                        ₹{item.price * item.quantity}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div
                                            className="p-4 flex justify-between items-center"
                                            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
                                        >
                                            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Total</span>
                                            <span className="text-xl font-display font-bold" style={{ color: 'var(--accent)' }}>
                                                ₹{selectedOrder.totalAmount}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
