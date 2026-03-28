import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/Skeleton';
import {
    X, User, Phone, MapPin, Package, Clock, CheckCircle, Truck, XCircle,
    ArrowRight, Navigation
} from 'lucide-react';

interface OrderItem {
    productId?: { name: string; image?: string };
    name: string;
    quantity: number;
    price: number;
}

interface Order {
    _id: string;
    orderId: string;
    userId: { name: string; phone?: string };
    items: OrderItem[];
    totalAmount: number;
    orderStatus: string;
    createdAt: string;
    deliveryAddress?: { street?: string; city?: string; pincode?: string };
    riderId?: { name: string; phone?: string };
}

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const STATUS_CONFIG: Record<string, { color: string; glow: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.2)', icon: <Clock className="w-4 h-4" />, label: 'Placed' },
    CONFIRMED: { color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.2)', icon: <CheckCircle className="w-4 h-4" />, label: 'Confirmed' },
    PACKED: { color: '#F97316', glow: 'rgba(249, 115, 22, 0.2)', icon: <Package className="w-4 h-4" />, label: 'Packed' },
    OUT_FOR_DELIVERY: { color: '#E6A23C', glow: 'rgba(230, 162, 60, 0.2)', icon: <Truck className="w-4 h-4" />, label: 'Out for Delivery' },
    DELIVERED: { color: '#22C55E', glow: 'rgba(34, 197, 94, 0.2)', icon: <CheckCircle className="w-4 h-4" />, label: 'Delivered' },
    CANCELLED: { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.2)', icon: <XCircle className="w-4 h-4" />, label: 'Cancelled' },
};

interface OrderDetailProps {
    order: Order;
    onClose: () => void;
    onStatusChange?: (orderId: string, newStatus: string) => void;
}

function OrderTimeline({ currentStatus }: { currentStatus: string }) {
    const steps = ['PENDING', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
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
                    boxShadow: '0 0 12px var(--success)',
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
                                transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
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

export default function OrderDetail({ order, onClose, onStatusChange }: OrderDetailProps) {
    const [updating, setUpdating] = useState(false);

    async function handleStatusUpdate(newStatus: string) {
        setUpdating(true);
        try {
            await api.updateOrderStatus(order._id, newStatus);
            if (onStatusChange) {
                onStatusChange(order._id, newStatus);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status. Please try again.');
        } finally {
            setUpdating(false);
        }
    }

    const config = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PENDING;
    const isActive = order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED';

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-slide-in-right"
                style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="sticky top-0 px-6 py-5 flex items-center justify-between z-10"
                    style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
                >
                    <div>
                        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Order {order.orderId}
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {new Date(order.createdAt).toLocaleString('en-IN')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
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
                        <OrderTimeline currentStatus={order.orderStatus} />
                    </div>

                    {/* Status Actions */}
                    {isActive && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                Update Status
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {STATUS_OPTIONS.filter(s => s !== order.orderStatus).map((status) => {
                                    const statusConfig = STATUS_CONFIG[status];
                                    return (
                                        <Button
                                            key={status}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleStatusUpdate(status)}
                                            disabled={updating}
                                            style={{
                                                borderColor: status === 'CANCELLED' ? 'var(--danger)' : 'var(--border)',
                                                color: status === 'CANCELLED' ? 'var(--danger)' : 'var(--text-secondary)',
                                            }}
                                        >
                                            {statusConfig?.icon}
                                            <span className="ml-1.5">{statusConfig?.label || status}</span>
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
                                <span style={{ color: 'var(--text-primary)' }}>{order.userId?.name || 'Guest'}</span>
                            </div>
                            {order.userId?.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ color: 'var(--text-primary)' }}>{order.userId.phone}</span>
                                </div>
                            )}
                            {order.deliveryAddress && (
                                <div className="flex items-start gap-3 text-sm">
                                    <MapPin className="w-4 h-4 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ color: 'var(--text-primary)' }}>
                                        {[order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rider Info */}
                    {order.riderId && (
                        <div>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                Assigned Rider
                            </h3>
                            <div
                                className="p-4 rounded-xl"
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                                        style={{
                                            background: 'var(--accent-gradient)',
                                            color: 'var(--bg-primary)',
                                        }}
                                    >
                                        {order.riderId.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {order.riderId.name}
                                        </p>
                                        {order.riderId.phone && (
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {order.riderId.phone}
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                                        style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}
                                    >
                                        <Navigation className="w-3 h-3" />
                                        Tracking
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                {order.items?.map((item, i) => (
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
                                    ₹{order.totalAmount}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
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
