import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/Skeleton';
import { Input } from '../ui/input';
import { EmptyState } from '../ui/EmptyState';
import {
    Bike, MapPin, Star, Package, TrendingUp, Phone, Search, RefreshCw,
    CheckCircle, XCircle, Clock, Navigation, AlertCircle
} from 'lucide-react';

interface Rider {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    status: 'available' | 'busy' | 'offline';
    rating: number;
    totalDeliveries: number;
    acceptanceRate: number;
    currentLocation?: {
        latitude: number;
        longitude: number;
    };
    vehicleType?: string;
    joinedAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    available: { color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)', icon: <CheckCircle className="w-4 h-4" />, label: 'Available' },
    busy: { color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', icon: <Clock className="w-4 h-4" />, label: 'Busy' },
    offline: { color: '#71717A', bg: 'rgba(113, 113, 122, 0.15)', icon: <XCircle className="w-4 h-4" />, label: 'Offline' },
};

interface RiderManagerProps {
    onAssignRider?: (rider: Rider) => void;
    orderId?: string;
    selectedRiderId?: string;
}

export default function RiderManager({ onAssignRider, orderId, selectedRiderId }: RiderManagerProps) {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('available');
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

    async function fetchRiders() {
        try {
            const data = await api.getRiders(statusFilter === 'all' ? undefined : statusFilter);
            setRiders(data.riders || data || []);
        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        if (typeof window !== 'undefined') {
            fetchRiders();
        }
    }, [statusFilter]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchRiders();
    };

    const handleAssignRider = (rider: Rider) => {
        if (onAssignRider) {
            onAssignRider(rider);
        }
    };

    const filteredRiders = riders.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search)
    );

    const stats = {
        total: riders.length,
        available: riders.filter(r => r.status === 'available').length,
        busy: riders.filter(r => r.status === 'busy').length,
        offline: riders.filter(r => r.status === 'offline').length,
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between">
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Rider Management
                    </h1>
                    <p className="mt-1 text-[var(--text-secondary)]">
                        Manage delivery riders and track their performance
                    </p>
                </div>
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="kpi-card">
                    <div className="flex items-center gap-3">
                        <div className="icon-container icon-blue">
                            <Bike className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="metric-label">Total Riders</p>
                            <p className="metric-value text-2xl">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="flex items-center gap-3">
                        <div className="icon-container icon-green">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="metric-label">Available</p>
                            <p className="metric-value text-2xl" style={{ color: '#22C55E' }}>{stats.available}</p>
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="flex items-center gap-3">
                        <div className="icon-container icon-orange">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="metric-label">Busy</p>
                            <p className="metric-value text-2xl" style={{ color: '#F97316' }}>{stats.busy}</p>
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="flex items-center gap-3">
                        <div className="icon-container icon-red">
                            <XCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="metric-label">Offline</p>
                            <p className="metric-value text-2xl" style={{ color: '#71717A' }}>{stats.offline}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <Input
                        placeholder="Search by name or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-11"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['available', 'busy', 'offline', 'all'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                                background: statusFilter === status ? 'var(--accent)' : 'var(--bg-tertiary)',
                                color: statusFilter === status ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                border: `1px solid ${statusFilter === status ? 'var(--accent)' : 'var(--border)'}`,
                            }}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Rider List */}
            {filteredRiders.length === 0 ? (
                <EmptyState type="orders" />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredRiders.map((rider, index) => {
                        const config = STATUS_CONFIG[rider.status] || STATUS_CONFIG.offline;
                        const isSelected = selectedRiderId === rider._id;

                        return (
                            <div
                                key={rider._id}
                                className={`rider-card animate-slide-up cursor-pointer ${isSelected ? 'selected' : ''}`}
                                style={{
                                    animationDelay: `${0.1 + index * 0.05}s`,
                                    border: isSelected ? `2px solid var(--accent)` : '1px solid var(--border)',
                                }}
                                onClick={() => setSelectedRider(rider)}
                            >
                                <div className="p-5 space-y-4">
                                    {/* Header */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                                                style={{
                                                    background: 'var(--accent-gradient)',
                                                    color: 'var(--bg-primary)',
                                                }}
                                            >
                                                {rider.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {rider.name}
                                                </h3>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {rider.vehicleType || 'Two Wheeler'}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                                            style={{
                                                background: config.bg,
                                                color: config.color,
                                            }}
                                        >
                                            {config.icon}
                                            {config.label}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <Star className="w-3 h-3" style={{ color: '#E6A23C' }} fill="#E6A23C" />
                                                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {rider.rating?.toFixed(1) || '4.8'}
                                                </span>
                                            </div>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rating</p>
                                        </div>
                                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {rider.totalDeliveries || 0}
                                            </p>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Deliveries</p>
                                        </div>
                                        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {rider.acceptanceRate || 95}%
                                            </p>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Accept</p>
                                        </div>
                                    </div>

                                    {/* Contact */}
                                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                                            <Phone className="w-4 h-4" />
                                            {rider.phone}
                                        </div>
                                        {orderId && onAssignRider && (
                                            <Button
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAssignRider(rider);
                                                }}
                                                disabled={rider.status !== 'available'}
                                            >
                                                {rider.status === 'available' ? 'Assign' : 'Unavailable'}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Location indicator */}
                                    {rider.currentLocation && (
                                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--info)' }}>
                                            <Navigation className="w-3 h-3" />
                                            Live location active
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .rider-card {
                    background: var(--bg-secondary);
                    border-radius: 16px;
                    transition: all 0.3s ease;
                }
                .rider-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
                }
                .rider-card.selected {
                    box-shadow: 0 0 30px var(--accent-glow);
                }
            `}</style>
        </div>
    );
}
