import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { getTrackingServiceUrl } from '../lib/config';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import {
    ShoppingCart, ChevronLeft, ChevronRight, Clock, Package, User, Phone, MapPin,
    CheckCircle, Truck, XCircle, RefreshCw, Search, X, Eye, Zap, LayoutGrid, List, UserPlus
} from 'lucide-react';

interface Order {
    _id: string;
    orderId: string;
    userId: { name: string; phone: string };
    items: { productId: { name: string }; name: string; quantity: number; price: number }[];
    totalAmount: number;
    orderStatus: string;
    createdAt: string;
    deliveryAddress?: { street?: string; city?: string; pincode?: string };
}
const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const NEXT_STATUS: Record<string, string[]> = {
    PENDING: ['CONFIRMED'],
    CONFIRMED: [],
    ASSIGNED: ['PACKED'],
    PACKED: [],
    PICKED_UP: [],
    OUT_FOR_DELIVERY: [],
};

const STATUS_CONFIG: Record<string, { color: string; glow: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.2)', icon: <Clock className="w-4 h-4" />, label: 'Placed' },
    CONFIRMED: { color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.2)', icon: <CheckCircle className="w-4 h-4" />, label: 'Confirmed' },
    PACKED: { color: '#F97316', glow: 'rgba(249, 115, 22, 0.2)', icon: <Package className="w-4 h-4" />, label: 'Packed' },
    ASSIGNED: { color: '#14B8A6', glow: 'rgba(20, 184, 166, 0.2)', icon: <UserPlus className="w-4 h-4" />, label: 'Rider Accepted' },
    PICKED_UP: { color: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.2)', icon: <Package className="w-4 h-4" />, label: 'Picked Up' },
    OUT_FOR_DELIVERY: { color: '#E6A23C', glow: 'rgba(230, 162, 60, 0.2)', icon: <Truck className="w-4 h-4" />, label: 'Out for Delivery' },
    DELIVERED: { color: '#22C55E', glow: 'rgba(34, 197, 94, 0.2)', icon: <CheckCircle className="w-4 h-4" />, label: 'Delivered' },
    CANCELLED: { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.2)', icon: <XCircle className="w-4 h-4" />, label: 'Cancelled' },
};
const STATUS_ACTION_LABELS: Record<string, string> = {
    CONFIRMED: 'Confirm',
    PACKED: 'Pack',
    CANCELLED: 'Cancel',
};
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];
const TRACKING_SOCKET_URL = getTrackingServiceUrl();

export default function OrdersManager() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [pageMode, setPageMode] = useState<'live' | 'completed' | 'returns'>('live');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const socketRef = useRef<Socket | null>(null);
    const selectedOrderRef = useRef<Order | null>(null);

    useEffect(() => {
        // Parse URL params
        const query = new URLSearchParams(window.location.search);
        const urlStatus = query.get('status');

        if (urlStatus === 'completed') {
            setPageMode('completed');
            setStatusFilter('DELIVERED,CANCELLED'); // Show both by default in completed
        } else if (urlStatus === 'returns') {
            setPageMode('returns');
            setStatusFilter('CANCELLED'); // Just an example, maybe there's a RETURNED status later
        } else {
            setPageMode('live');
            setStatusFilter(''); // Default to 'All' live orders
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter, pageMode]);

    useEffect(() => {
        selectedOrderRef.current = selectedOrder;
    }, [selectedOrder]);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            return;
        }

        const socket = io(TRACKING_SOCKET_URL, {
            // Read the token on every (re)connect so refreshed tokens are picked up.
            auth: (cb) => cb({ token: localStorage.getItem('adminToken') }),
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
            orders.forEach((order) => {
                if (ACTIVE_STATUSES.includes(order.orderStatus)) {
                    socket.emit('joinOrderRoom', { orderId: order._id });
                }
            });
        });

        socket.on('orderStatusUpdate', (data: any) => {
            setOrders((prev) => prev.map((order) => (
                order._id === data.orderId
                    ? {
                        ...order,
                        ...(data.order || {}),
                        orderStatus: data.status,
                    }
                    : order
            )));

            if (selectedOrderRef.current?._id === data.orderId) {
                setSelectedOrder((prev) => prev ? {
                    ...prev,
                    ...(data.order || {}),
                    orderStatus: data.status,
                } : null);
            }
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!socketRef.current?.connected) {
            return;
        }

        orders.forEach((order) => {
            if (ACTIVE_STATUSES.includes(order.orderStatus)) {
                socketRef.current?.emit('joinOrderRoom', { orderId: order._id });
            }
        });
    }, [orders]);

    async function fetchOrders() {
        try {
            // If we're in 'live' mode and no specific status is selected,
            // we want to fetch all LIVE statuses (not DELIVERED or CANCELLED)
            let queryStatus = statusFilter;

            if (pageMode === 'live' && !statusFilter) {
                queryStatus = 'PENDING,CONFIRMED,ASSIGNED,PACKED,PICKED_UP,OUT_FOR_DELIVERY';
            }

            const data = await api.getOrders({ page, status: queryStatus || undefined });
            setOrders(data.orders || []);
            setTotalPages(data.pagination?.pages || 1);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    async function updateStatus(orderId: string, newStatus: string) {
        try {
            await api.updateOrderStatus(orderId, newStatus);
            fetchOrders();
            if (selectedOrder?._id === orderId) {
                setSelectedOrder({ ...selectedOrder, orderStatus: newStatus });
            }
        } catch (error: any) {
            alert(error?.message || 'Error updating status');
        }
    }

    const statusCounts = orders.reduce((acc, order) => {
        acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const filteredOrders = orders.filter(o =>
        o.orderId.toLowerCase().includes(search.toLowerCase()) ||
        o.userId?.name?.toLowerCase().includes(search.toLowerCase())
    );

    // Animated Timeline
    function OrderTimeline({ currentStatus }: { currentStatus: string }) {
        const steps = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        const currentIndex = steps.indexOf(currentStatus);
        const isCancelled = currentStatus === 'CANCELLED';

        return (
            <div className="flex items-center justify-between relative py-4">
                <div
                    className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-1 rounded-full"
                    style={{ background: 'var(--bg-tertiary)' }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 left-4 h-1 rounded-full transition-all duration-700"
                    style={{
                        width: isCancelled ? '0%' : `calc(${(currentIndex / (steps.length - 1)) * 100}% - 32px)`,
                        background: 'var(--success)',
                        boxShadow: '0 0 12px var(--success)'
                    }}
                />
                {steps.map((step, index) => {
                    const isComplete = !isCancelled && index <= currentIndex;
                    const isCurrent = !isCancelled && index === currentIndex;
                    const config = STATUS_CONFIG[step];
                    return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                                style={{
                                    background: isCancelled ? 'var(--bg-tertiary)' : isComplete ? config.color : 'var(--bg-tertiary)',
                                    color: isComplete ? '#fff' : 'var(--text-muted)',
                                    boxShadow: isCurrent ? `0 0 20px ${config.glow}, 0 0 0 4px ${config.glow}` : 'none',
                                    transform: isCurrent ? 'scale(1.1)' : 'scale(1)'
                                }}
                            >
                                {config.icon}
                            </div>
                            <span
                                className="text-[10px] mt-2 font-semibold text-center"
                                style={{ color: isComplete ? 'var(--text-primary)' : 'var(--text-muted)' }}
                            >
                                {config.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <div className="flex justify-between">
                        <Skeleton className="h-12 w-64" />
                        <Skeleton className="h-10 w-40" />
                    </div>
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
                <div className="animate-slide-up delay-1">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    {pageMode === 'live' ? 'Live Operations' : pageMode === 'completed' ? 'History' : 'Returns'}
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                {pageMode === 'live' ? 'Live Orders' : pageMode === 'completed' ? 'Completed Orders' : 'Returns & Replacements'}
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                {pageMode === 'live' ? 'Manage and track live customer orders' : 'View order history'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                className="flex rounded-xl p-1"
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                            >
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className="p-2 rounded-lg transition-all"
                                    style={{
                                        background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
                                        color: viewMode === 'cards' ? 'var(--bg-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className="p-2 rounded-lg transition-all"
                                    style={{
                                        background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                                        color: viewMode === 'table' ? 'var(--bg-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Status Filter Pills */}
                <div className="flex gap-3 flex-wrap animate-slide-up delay-2">
                    <button
                        onClick={() => {
                            if (pageMode === 'live') setStatusFilter('');
                            else if (pageMode === 'completed') setStatusFilter('DELIVERED,CANCELLED');
                            else setStatusFilter('');
                            setPage(1);
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{
                            background: (!statusFilter || statusFilter === 'DELIVERED,CANCELLED') ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: (!statusFilter || statusFilter === 'DELIVERED,CANCELLED') ? 'var(--bg-primary)' : 'var(--text-secondary)',
                            border: '1px solid ' + ((!statusFilter || statusFilter === 'DELIVERED,CANCELLED') ? 'var(--accent)' : 'var(--border)')
                        }}
                    >
                        All ({orders.length})
                    </button>
                    {(pageMode === 'live'
                        ? ['PENDING', 'CONFIRMED', 'PACKED', 'ASSIGNED', 'OUT_FOR_DELIVERY']
                        : pageMode === 'completed'
                            ? ['DELIVERED', 'CANCELLED']
                            : ['CANCELLED']
                    ).map((status) => {
                        const config = STATUS_CONFIG[status];
                        const isActive = statusFilter === status;
                        return (
                            <button
                                key={status}
                                onClick={() => { setStatusFilter(status); setPage(1); }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                                style={{
                                    background: isActive ? config.glow : 'var(--bg-tertiary)',
                                    color: isActive ? config.color : 'var(--text-secondary)',
                                    border: `1px solid ${isActive ? config.color : 'var(--border)'}`,
                                    boxShadow: isActive ? `0 0 20px ${config.glow}` : 'none'
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
                <div className="flex gap-4 animate-slide-up delay-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search by order ID or customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11"
                        />
                    </div>
                </div>

                {/* Cards View */}
                {viewMode === 'cards' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredOrders.length === 0 ? (
                            <div className="col-span-full animate-slide-up delay-4">
                                <EmptyState type="orders" />
                            </div>
                        ) : (
                            filteredOrders.map((order, index) => {
                                const config = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PENDING;
                                return (
                                    <div
                                        key={order._id}
                                        className="group animate-slide-up cursor-pointer"
                                        style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <div
                                            className="relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                borderColor: 'var(--border)',
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.borderColor = config.color + '60';
                                                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${config.glow}`;
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                            }}
                                        >
                                            {/* Top accent line */}
                                            <div
                                                className="absolute top-0 left-6 right-6 h-0.5 rounded-full"
                                                style={{ background: config.color, opacity: 0.6 }}
                                            />

                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <p className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                                        {order.orderId}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        {new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div
                                                    className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                                                    style={{
                                                        background: config.glow,
                                                        color: config.color,
                                                        boxShadow: `0 0 10px ${config.glow}`
                                                    }}
                                                >
                                                    {config.icon}
                                                    {config.label}
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ color: 'var(--text-secondary)' }}>{order.userId?.name || 'Guest'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Package className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                    <span style={{ color: 'var(--text-secondary)' }}>{order.items?.length || 0} items</span>
                                                </div>
                                            </div>

                                            <div
                                                className="flex items-center justify-between pt-4"
                                                style={{ borderTop: '1px solid var(--border)' }}
                                            >
                                                <span className="text-xl font-display font-bold" style={{ color: 'var(--accent)' }}>
                                                    ₹{order.totalAmount}
                                                </span>
                                                <button
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    <Eye className="w-4 h-4" /> View
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Table View */}
                {viewMode === 'table' && (
                    <div
                        className="rounded-2xl overflow-hidden animate-slide-up delay-4"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    >
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th></th>
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
                                            <td>{order.userId?.name || 'Guest'}</td>
                                            <td>{order.items?.length || 0} items</td>
                                            <td>
                                                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                                                    ₹{order.totalAmount}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                                    style={{ background: config.glow, color: config.color }}
                                                >
                                                    {config.icon}
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                                            <td>
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-2 rounded-lg transition-colors"
                                                    style={{ color: 'var(--text-muted)' }}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="flex items-center justify-center gap-3 animate-slide-up delay-5">
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
                                <div
                                    className="p-4 rounded-xl"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                        Order Progress
                                    </h3>
                                    <OrderTimeline currentStatus={selectedOrder.orderStatus} />
                                </div>

                                {/* Status Actions */}
                                {selectedOrder.orderStatus !== 'DELIVERED' && selectedOrder.orderStatus !== 'CANCELLED' && (
                                    <div>
                                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                            Update Status
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {[...(NEXT_STATUS[selectedOrder.orderStatus] || []), 'CANCELLED'].map((status) => {
                                                const config = STATUS_CONFIG[status];
                                                const actionLabel = STATUS_ACTION_LABELS[status] || config?.label || status;
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
                                                    >
                                                        {config?.icon}
                                                        <span className="ml-1.5">{actionLabel}</span>
                                                    </Button>
                                                );
                                            })}
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
                                                    {[selectedOrder.deliveryAddress.street, selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.pincode].filter(Boolean).join(', ')}
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
