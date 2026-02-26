import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/Skeleton';
import { BarChart, LineChart, DonutChart } from './ui/Chart';
import { EmptyState } from './ui/EmptyState';
import {
    ShoppingCart,
    IndianRupee,
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    Package,
    Clock,
    ArrowUpRight,
    ArrowRight,
    AlertTriangle,
    RefreshCw,
    Box,
    XCircle,
    Truck,
    Users,
    Zap,
    BarChart3,
    Activity
} from 'lucide-react';

interface Order {
    _id: string;
    orderId: string;
    userId: { name: string };
    totalAmount: number;
    orderStatus: string;
    createdAt: string;
}

// Chart data
const weeklyData = [
    { label: 'Mon', value: 12500 },
    { label: 'Tue', value: 18200 },
    { label: 'Wed', value: 15800 },
    { label: 'Thu', value: 22100 },
    { label: 'Fri', value: 28400 },
    { label: 'Sat', value: 35600 },
    { label: 'Sun', value: 31200 },
];

const categoryData = [
    { label: 'Beverages', value: 45200, color: '#E6A23C' },
    { label: 'Dairy Products', value: 38100, color: '#3B82F6' },
    { label: 'Snacks & Chips', value: 29400, color: '#22C55E' },
    { label: 'Personal Care', value: 22800, color: '#A855F7' },
    { label: 'Household', value: 18600, color: '#F97316' },
];

const orderStatusData = [
    { label: 'Pending', value: 12, color: '#FBBF24' },
    { label: 'Processing', value: 8, color: '#3B82F6' },
    { label: 'Delivered', value: 45, color: '#22C55E' },
    { label: 'Cancelled', value: 3, color: '#EF4444' },
];

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function fetchData() {
        try {
            // Check if we have a token before making API calls
            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.warn('No admin token found, redirecting to login');
                window.location.href = '/login';
                return;
            }

            const [analytics, ordersData] = await Promise.all([
                api.getDailyAnalytics().catch(err => {
                    console.error('Analytics error:', err);
                    return null;
                }),
                api.getOrders({ page: 1 }).catch(err => {
                    console.error('Orders error:', err);
                    return { orders: [] };
                }),
            ]);
            if (analytics) setStats(analytics);
            setOrders(ordersData?.orders?.slice(0, 6) || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        // Only fetch if we have auth token
        if (typeof window !== 'undefined' && localStorage.getItem('adminToken')) {
            fetchData();
        } else if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const pendingOrders = (stats?.ordersByStatus?.PLACED || 0) + (stats?.ordersByStatus?.CONFIRMED || 0);
    const outForDelivery = stats?.ordersByStatus?.OUT_FOR_DELIVERY || 0;
    const deliveredToday = stats?.ordersByStatus?.DELIVERED || 0;

    const statusColors: Record<string, string> = {
        PLACED: 'status-pending',
        CONFIRMED: 'status-confirmed',
        PACKED: 'status-confirmed',
        OUT_FOR_DELIVERY: 'status-confirmed',
        DELIVERED: 'status-delivered',
        CANCELLED: 'status-cancelled',
    };

    return (
        <div className="dashboard-bg min-h-screen">
            <div className="relative z-10 p-6 lg:p-8 space-y-8">

                {/* Hero Header */}
                <div className="animate-slide-up delay-1">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="live-dot" />
                                <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                                    Live Dashboard
                                </span>
                            </div>
                            <h1 className="font-display text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight">
                                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}
                            </h1>
                            <p className="text-[var(--text-secondary)] mt-2 text-lg">
                                Here's what's happening with your store today.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="btn-ghost flex items-center gap-2 text-sm"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <div className="text-xs text-[var(--text-muted)] hidden lg:block">
                                Last updated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Today's Revenue */}
                    <div className="kpi-card animate-slide-up delay-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="metric-label">Today's Revenue</p>
                                {loading ? (
                                    <div className="skeleton h-9 w-32 mt-1" />
                                ) : (
                                    <p className="metric-value">
                                        ₹{(stats?.totalRevenue || 164320).toLocaleString()}
                                    </p>
                                )}
                                <div className="trend-up mt-3">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>+18.2%</span>
                                    <span className="text-[var(--text-muted)] font-normal ml-1">vs yesterday</span>
                                </div>
                            </div>
                            <div className="icon-container icon-amber">
                                <IndianRupee className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Total Orders */}
                    <div className="kpi-card animate-slide-up delay-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="metric-label">Total Orders</p>
                                {loading ? (
                                    <div className="skeleton h-9 w-20 mt-1" />
                                ) : (
                                    <p className="metric-value">{stats?.totalOrders || 68}</p>
                                )}
                                <div className="trend-up mt-3">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>+12.5%</span>
                                    <span className="text-[var(--text-muted)] font-normal ml-1">vs yesterday</span>
                                </div>
                            </div>
                            <div className="icon-container icon-blue">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Active Products */}
                    <div className="kpi-card animate-slide-up delay-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="metric-label">Active Products</p>
                                {loading ? (
                                    <div className="skeleton h-9 w-16 mt-1" />
                                ) : (
                                    <p className="metric-value">{stats?.activeProducts || 248}</p>
                                )}
                                <div className="flex items-center gap-2 mt-3 text-sm text-[var(--text-muted)]">
                                    <Box className="w-3.5 h-3.5" />
                                    <span>Across 12 categories</span>
                                </div>
                            </div>
                            <div className="icon-container icon-green">
                                <Package className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* Out of Stock */}
                    <div className="kpi-card animate-slide-up delay-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="metric-label">Out of Stock</p>
                                {loading ? (
                                    <div className="skeleton h-9 w-12 mt-1" />
                                ) : (
                                    <p className="metric-value text-[var(--danger)]">{stats?.outOfStock || 7}</p>
                                )}
                                <div className="trend-down mt-3">
                                    <TrendingDown className="w-4 h-4" />
                                    <span>+3 items</span>
                                    <span className="text-[var(--text-muted)] font-normal ml-1">needs restock</span>
                                </div>
                            </div>
                            <div className="icon-container icon-red">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Status Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-slide-up delay-6">
                    <div className="quick-stat group">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                                {loading ? '—' : pendingOrders}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">Pending Orders</p>
                        </div>
                        <a href="/orders" className="text-[var(--accent)] hover:underline text-sm font-medium flex items-center gap-1">
                            View <ArrowRight className="w-3 h-3" />
                        </a>
                    </div>

                    <div className="quick-stat group">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Truck className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                                {loading ? '—' : outForDelivery}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">Out for Delivery</p>
                        </div>
                        <a href="/orders" className="text-[var(--accent)] hover:underline text-sm font-medium flex items-center gap-1">
                            Track <ArrowRight className="w-3 h-3" />
                        </a>
                    </div>

                    <div className="quick-stat group">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-2xl font-display font-bold text-[var(--text-primary)]">
                                {loading ? '—' : deliveredToday}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">Delivered Today</p>
                        </div>
                        <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                            <Zap className="w-3 h-3" /> On Track
                        </span>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up delay-7">
                    {/* Revenue Chart - 2/3 width */}
                    <div className="lg:col-span-2 chart-container">
                        <div className="p-6 border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center">
                                        <Activity className="w-5 h-5 text-[var(--accent)]" />
                                    </div>
                                    <div>
                                        <h3 className="section-title">Revenue Trend</h3>
                                        <p className="text-sm text-[var(--text-muted)]">Weekly sales performance</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg">
                                        Weekly
                                    </button>
                                    <button className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                                        Monthly
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            {loading ? (
                                <div className="skeleton h-52 w-full" />
                            ) : (
                                <LineChart data={weeklyData} height={200} color="#E6A23C" />
                            )}
                        </div>
                    </div>

                    {/* Order Status Donut - 1/3 width */}
                    <div className="chart-container">
                        <div className="p-6 border-b border-[var(--border)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[var(--info-light)] flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-[var(--info)]" />
                                </div>
                                <div>
                                    <h3 className="section-title">Order Status</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Distribution today</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            {loading ? (
                                <div className="skeleton h-48 w-full rounded-full" />
                            ) : (
                                <DonutChart data={orderStatusData} size={180} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Category Performance & Recent Orders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up delay-8">
                    {/* Category Performance */}
                    <div className="chart-container">
                        <div className="p-6 border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="section-title">Top Categories</h3>
                                        <p className="text-sm text-[var(--text-muted)]">Sales by category</p>
                                    </div>
                                </div>
                                <a href="/analytics" className="text-[var(--accent)] hover:underline text-sm font-medium flex items-center gap-1">
                                    Details <ArrowUpRight className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                        <div className="p-6">
                            {loading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="skeleton h-10 w-full" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {categoryData.map((cat, i) => (
                                        <div key={cat.label} className="flex items-center gap-4">
                                            <div className="w-8 text-sm font-medium text-[var(--text-muted)]">
                                                #{i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-[var(--text-primary)]">{cat.label}</span>
                                                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                                                        ₹{(cat.value / 1000).toFixed(1)}K
                                                    </span>
                                                </div>
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{
                                                            width: `${(cat.value / categoryData[0].value) * 100}%`,
                                                            background: cat.color
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Orders */}
                    <div className="chart-container overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <ShoppingCart className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <h3 className="section-title">Recent Orders</h3>
                                        <p className="text-sm text-[var(--text-muted)]">Latest transactions</p>
                                    </div>
                                </div>
                                <a href="/orders" className="text-[var(--accent)] hover:underline text-sm font-medium flex items-center gap-1">
                                    View All <ArrowUpRight className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Customer</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i}>
                                                <td><div className="skeleton h-5 w-16" /></td>
                                                <td><div className="skeleton h-5 w-24" /></td>
                                                <td><div className="skeleton h-5 w-16" /></td>
                                                <td><div className="skeleton h-5 w-20" /></td>
                                            </tr>
                                        ))
                                    ) : orders.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12">
                                                <EmptyState type="orders" />
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order._id}>
                                                <td>
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        {order.orderId}
                                                    </span>
                                                </td>
                                                <td>{order.userId?.name || 'Guest'}</td>
                                                <td>
                                                    <span className="font-semibold text-[var(--text-primary)]">
                                                        ₹{order.totalAmount}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${statusColors[order.orderStatus] || 'status-pending'}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        {order.orderStatus.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
