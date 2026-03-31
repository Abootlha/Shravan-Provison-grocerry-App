import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/Skeleton';
import {
    X, Search, MapPin, Navigation, CheckCircle, Bike, Phone
} from 'lucide-react';

interface Rider {
    _id: string;
    name: string;
    phone: string;
    status: 'available' | 'busy' | 'offline';
    rating: number;
    currentLocation?: {
        latitude: number;
        longitude: number;
    };
}

interface RiderAssignerProps {
    orderId: string;
    onClose: () => void;
    onAssign: (riderId: string) => void;
}

export default function RiderAssigner({ orderId, onClose, onAssign }: RiderAssignerProps) {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [assigning, setAssigning] = useState<string | null>(null);

    useEffect(() => {
        fetchAvailableRiders();
    }, []);

    async function fetchAvailableRiders() {
        try {
            const data = await api.getAvailableRiders();
            setRiders(data.riders || data || []);
        } catch (error) {
            console.error('Error fetching riders:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAssign(riderId: string) {
        setAssigning(riderId);
        try {
            await api.assignRider(orderId, riderId);
            onAssign(riderId);
            onClose();
        } catch (error) {
            console.error('Error assigning rider:', error);
            alert('Failed to assign rider. Please try again.');
        } finally {
            setAssigning(null);
        }
    }

    const filteredRiders = riders.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.includes(search)
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-5"
                    style={{ borderBottom: '1px solid var(--border)' }}
                >
                    <div>
                        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Assign Rider
                        </h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                            Order #{orderId}
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

                {/* Search */}
                <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search available riders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11"
                        />
                    </div>
                </div>

                {/* Rider List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-12 h-12 rounded-xl" />
                                    <div className="flex-1">
                                        <Skeleton className="h-5 w-32 mb-2" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : filteredRiders.length === 0 ? (
                        <div className="text-center py-8">
                            <Bike className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                No riders available
                            </p>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                All riders are currently busy or offline
                            </p>
                        </div>
                    ) : (
                        filteredRiders.map((rider) => (
                            <div
                                key={rider._id}
                                className="p-4 rounded-xl transition-all cursor-pointer hover:scale-[1.02]"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border)',
                                }}
                                onClick={() => handleAssign(rider._id)}
                            >
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
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {rider.name}
                                            </h3>
                                            <div className="flex items-center gap-1 text-xs" style={{ color: '#E6A23C' }}>
                                                <span>★</span>
                                                <span>{typeof rider.rating === 'number' ? rider.rating.toFixed(1) : 'NA'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <Phone className="w-3 h-3" />
                                                {rider.phone}
                                            </div>
                                            {rider.currentLocation && (
                                                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
                                                    <Navigation className="w-3 h-3" />
                                                    Live
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                                        style={{
                                            background: 'rgba(34, 197, 94, 0.15)',
                                            color: '#22C55E',
                                        }}
                                    >
                                        <CheckCircle className="w-3 h-3" />
                                        Available
                                    </div>
                                </div>

                                {assigning === rider._id && (
                                    <div className="mt-3 pt-3 flex items-center justify-center" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
                                        <span className="ml-2 text-sm" style={{ color: 'var(--accent)' }}>
                                            Assigning rider...
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <Button variant="outline" onClick={onClose} className="w-full">
                        Cancel
                    </Button>
                </div>
            </div>

            <style>{`
                @keyframes scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
