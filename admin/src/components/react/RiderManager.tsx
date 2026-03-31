import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/Skeleton';
import { Input } from '../ui/input';
import { EmptyState } from '../ui/EmptyState';
import {
    Bike, MapPin, Star, Package, TrendingUp, Phone, Search, RefreshCw,
    CheckCircle, XCircle, Clock, Navigation, AlertCircle, User, Calendar,
    Eye, Edit3, Trash2, MapPinned
} from 'lucide-react';

interface Rider {
    _id: string;
    name: string;
    username: string;
    phone: string;
    email?: string;
    status: 'available' | 'busy' | 'offline';
    rating: number;
    totalDeliveries: number;
    totalRatings: number;
    acceptanceRate: number;
    currentLocation?: {
        type: string;
        coordinates: [number, number];
    };
    vehicleType?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
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

    // Create Rider State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newRider, setNewRider] = useState({
        name: '',
        username: '',
        password: '',
        phone: '',
        vehicleType: 'Two Wheeler'
    });

    const handleCreateRider = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.createRider(newRider);
            setShowCreateModal(false);
            setNewRider({
                name: '',
                username: '',
                password: '',
                phone: '',
                vehicleType: 'Two Wheeler'
            });
            fetchRiders(); // Refresh the list
        } catch (error) {
            console.error('Error creating rider:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (message.includes('Username or phone number already registered')) {
                alert('A rider with this username or phone number already exists. Please use different credentials.');
            } else {
                alert('Failed to create rider. Please try again.');
            }
        } finally {
            setCreating(false);
        }
    };

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
                <div className="flex gap-3">
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Bike className="w-4 h-4 mr-2" />
                        Create Rider
                    </Button>
                    <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Create Rider Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--bg-secondary)] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-zoom-in">
                        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-tertiary)]">
                            <h2 className="text-xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>Create New Rider</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRider} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                                <Input
                                    required
                                    placeholder="e.g. John Doe"
                                    value={newRider.name}
                                    onChange={(e) => setNewRider({ ...newRider, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Username</label>
                                    <Input
                                        required
                                        placeholder="rider_john"
                                        value={newRider.username}
                                        onChange={(e) => setNewRider({ ...newRider, username: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Password</label>
                                    <Input
                                        required
                                        type="password"
                                        placeholder="******"
                                        value={newRider.password}
                                        onChange={(e) => setNewRider({ ...newRider, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Phone Number</label>
                                <Input
                                    required
                                    placeholder="10-digit mobile number"
                                    value={newRider.phone}
                                    onChange={(e) => setNewRider({ ...newRider, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Vehicle Type</label>
                                <select
                                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                                    style={{ color: 'var(--text-primary)' }}
                                    value={newRider.vehicleType}
                                    onChange={(e) => setNewRider({ ...newRider, vehicleType: e.target.value })}
                                >
                                    <option value="Two Wheeler">Two Wheeler</option>
                                    <option value="Bicycle">Bicycle</option>
                                    <option value="Electric Bike">Electric Bike</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Rider'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rider Details Modal */}
            {selectedRider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--bg-secondary)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-zoom-in">
                        {/* Header */}
                        <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-tertiary)] flex justify-between items-center">
                            <h2 className="text-xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>Rider Details</h2>
                            <button onClick={() => setSelectedRider(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Profile */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                                    style={{
                                        background: 'var(--accent-gradient)',
                                        color: 'var(--bg-primary)',
                                    }}
                                >
                                    {selectedRider.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{selectedRider.name}</h3>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{selectedRider.username}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span
                                            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                            style={{
                                                background: STATUS_CONFIG[selectedRider.status]?.bg || 'rgba(113, 113, 122, 0.15)',
                                                color: STATUS_CONFIG[selectedRider.status]?.color || '#71717A',
                                            }}
                                        >
                                            {STATUS_CONFIG[selectedRider.status]?.label || 'Offline'}
                                        </span>
                                        {!selectedRider.isActive && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Phone className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Phone</span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedRider.phone}</p>
                                </div>
                                <div className="p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Bike className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Vehicle</span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedRider.vehicleType || 'Two Wheeler'}</p>
                                </div>
                            </div>

                            {/* Performance Stats */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Performance</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <Star className="w-4 h-4" style={{ color: '#E6A23C' }} fill="#E6A23C" />
                                            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {selectedRider.rating?.toFixed(1) || '0.0'}
                                            </span>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            Rating ({selectedRider.totalRatings || 0} reviews)
                                        </p>
                                    </div>
                                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <Package className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
                                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {selectedRider.totalDeliveries || 0}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Deliveries</p>
                                    </div>
                                    <div className="text-center p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <TrendingUp className="w-5 h-5 mx-auto mb-1" style={{ color: '#22C55E' }} />
                                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {selectedRider.acceptanceRate || 0}%
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Acceptance</p>
                                    </div>
                                </div>
                            </div>

                            {/* Location */}
                            {selectedRider.currentLocation && (
                                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'var(--bg-tertiary)' }}>
                                    <MapPinned className="w-5 h-5" style={{ color: 'var(--info)' }} />
                                    <div>
                                        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Current Location</p>
                                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                            {selectedRider.currentLocation.coordinates[1]?.toFixed(5)}, {selectedRider.currentLocation.coordinates[0]?.toFixed(5)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Account Info */}
                            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Account Information</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>Joined:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>
                                            {new Date(selectedRider.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>Last Updated:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>
                                            {new Date(selectedRider.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>Rider ID:</span>
                                        <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{selectedRider._id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border)] flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedRider(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRider(rider);
                                                }}
                                            >
                                                <Eye className="w-3.5 h-3.5 mr-1" />
                                                Details
                                            </Button>
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
