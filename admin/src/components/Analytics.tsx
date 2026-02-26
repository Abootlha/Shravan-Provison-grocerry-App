import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/Skeleton';
import { BarChart, LineChart, DonutChart } from './ui/Chart';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    IndianRupee,
    ShoppingBag,
    BarChart3,
    Trophy,
    Download,
    FileSpreadsheet,
    RefreshCw,
    ArrowUpRight
} from 'lucide-react';

export default function Analytics() {
    const [daily, setDaily] = useState<any>(null);
    const [weekly, setWeekly] = useState<any>(null);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dateRange, setDateRange] = useState<'weekly' | 'monthly'>('weekly');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [dailyData, weeklyData, productsData] = await Promise.all([
                api.getDailyAnalytics(),
                api.getWeeklyAnalytics(),
                api.getTopProducts(),
            ]);
            setDaily(dailyData);
            setWeekly(weeklyData);
            setTopProducts(productsData || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Export functionality
    const exportToCSV = () => {
        const headers = ['Date', 'Revenue', 'Orders', 'Avg Order Value'];
        const rows = weekly?.dailyBreakdown?.map((day: any) => [
            day.date,
            day.revenue,
            day.orders,
            Math.round(day.revenue / (day.orders || 1))
        ]) || [];

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Prepare chart data
    const salesTrendData = weekly?.dailyBreakdown?.map((day: any) => ({
        label: new Date(day.date).toLocaleDateString('en', { weekday: 'short' }),
        value: day.revenue || 0
    })) || [];

    const categoryData = [
        { label: 'Beverages', value: 45200, color: 'bg-green-500' },
        { label: 'Dairy', value: 38100, color: 'bg-blue-500' },
        { label: 'Snacks', value: 29400, color: 'bg-orange-500' },
        { label: 'Personal Care', value: 22800, color: 'bg-purple-500' },
        { label: 'Household', value: 18600, color: 'bg-pink-500' },
    ];

    const donutData = [
        { label: 'Delivered', value: daily?.ordersByStatus?.DELIVERED || 0, color: '#22c55e' },
        { label: 'Pending', value: (daily?.ordersByStatus?.PLACED || 0) + (daily?.ordersByStatus?.CONFIRMED || 0), color: '#eab308' },
        { label: 'In Transit', value: daily?.ordersByStatus?.OUT_FOR_DELIVERY || 0, color: '#3b82f6' },
        { label: 'Cancelled', value: daily?.ordersByStatus?.CANCELLED || 0, color: '#ef4444' },
    ];

    const totalOrders = donutData.reduce((sum, d) => sum + d.value, 0);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-64" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80 rounded-xl" />
                    <Skeleton className="h-80 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {weekly?.startDate} - {weekly?.endDate}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-gray-200 p-0.5">
                        <button
                            onClick={() => setDateRange('weekly')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === 'weekly' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setDateRange('monthly')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateRange === 'monthly' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
                        >
                            Monthly
                        </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9">
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToCSV} className="h-9">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-green-100 text-sm font-medium">{dateRange === 'weekly' ? 'Weekly' : 'Monthly'} Revenue</p>
                                <p className="text-2xl font-bold mt-1">₹{(weekly?.totalRevenue || 0).toLocaleString()}</p>
                                <div className="flex items-center gap-1 text-green-100 text-xs mt-2">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+15.3% vs last week</span>
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/20">
                                <IndianRupee className="w-5 h-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Total Orders</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{weekly?.totalOrders || 0}</p>
                                <div className="flex items-center gap-1 text-green-600 text-xs mt-2">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+12% vs last week</span>
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-blue-50">
                                <ShoppingBag className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Avg Order Value</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">₹{Math.round(weekly?.averageOrderValue || 0)}</p>
                                <div className="flex items-center gap-1 text-red-500 text-xs mt-2">
                                    <TrendingDown className="w-3 h-3" />
                                    <span>-3.2% vs last week</span>
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-purple-50">
                                <BarChart3 className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Conversion Rate</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">68.5%</p>
                                <div className="flex items-center gap-1 text-green-600 text-xs mt-2">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>+5.1% vs last week</span>
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-orange-50">
                                <ArrowUpRight className="w-5 h-5 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Trend */}
                <Card className="lg:col-span-2 border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Sales Trend
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="pb-6">
                            <LineChart data={salesTrendData} height={220} />
                        </div>
                    </CardContent>
                </Card>

                {/* Order Status Donut */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Order Status</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center py-4">
                        <DonutChart
                            data={donutData}
                            size={160}
                            centerLabel={
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                                    <p className="text-xs text-gray-500">Orders</p>
                                </div>
                            }
                        />
                        <div className="grid grid-cols-2 gap-3 mt-4 w-full">
                            {donutData.map((item) => (
                                <div key={item.label} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-gray-600">{item.label} ({item.value})</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Performance */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold">Category Performance</CardTitle>
                            <a href="/products" className="text-xs text-green-600 hover:text-green-700 font-medium">View All</a>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <BarChart data={categoryData} />
                    </CardContent>
                </Card>

                {/* Top Products */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500" />
                                Top Selling Products
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {topProducts.length === 0 ? (
                                <p className="p-6 text-center text-gray-500">No data yet</p>
                            ) : (
                                topProducts.slice(0, 5).map((product, i) => (
                                    <div key={product._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                i === 1 ? 'bg-gray-100 text-gray-700' :
                                                    i === 2 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-gray-50 text-gray-500'
                                            }`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                                            <p className="text-xs text-gray-500">{product.totalQuantity} units</p>
                                        </div>
                                        <span className="font-semibold text-sm text-green-600">₹{product.totalRevenue?.toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Breakdown */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Today's Order Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {Object.entries(daily?.ordersByStatus || {}).map(([status, count]) => {
                            const colors: Record<string, string> = {
                                PLACED: 'bg-blue-50 text-blue-700 border-blue-200',
                                CONFIRMED: 'bg-purple-50 text-purple-700 border-purple-200',
                                PACKED: 'bg-orange-50 text-orange-700 border-orange-200',
                                OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700 border-amber-200',
                                DELIVERED: 'bg-green-50 text-green-700 border-green-200',
                                CANCELLED: 'bg-red-50 text-red-700 border-red-200',
                            };
                            return (
                                <div key={status} className={`p-4 rounded-xl border ${colors[status] || 'bg-gray-50 border-gray-200'}`}>
                                    <p className="text-2xl font-bold">{count as number}</p>
                                    <p className="text-xs font-medium mt-1">{status.replace(/_/g, ' ')}</p>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
