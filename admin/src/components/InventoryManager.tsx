import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import {
    Package, AlertTriangle, Search, RefreshCw, TrendingDown, ArrowUpDown,
    ChevronLeft, ChevronRight, Boxes, CheckCircle2, XCircle
} from 'lucide-react';

interface Product {
    _id: string;
    name: string;
    unit: string;
    stock: number;
    image?: string;
    categoryId: { _id: string; name: string } | string;
}

interface StockStats {
    total: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
}

export default function InventoryManager() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const REORDER_LEVEL = 10;
    const LOW_STOCK_THRESHOLD = 20;

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const data = await api.getProducts({ limit: 200 });
            setProducts(data.products || []);
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

    const stats: StockStats = {
        total: products.length,
        inStock: products.filter(p => p.stock >= LOW_STOCK_THRESHOLD).length,
        lowStock: products.filter(p => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD).length,
        outOfStock: products.filter(p => p.stock === 0).length,
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filter === 'all' ||
            (filter === 'low' && p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD) ||
            (filter === 'out' && p.stock === 0);
        return matchesSearch && matchesFilter;
    }).sort((a, b) => a.stock - b.stock);

    const paginatedProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-96 rounded-2xl" />
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
                                <Boxes className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Stock Control
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Inventory
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                Monitor stock levels and manage inventory
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up delay-2">
                    <div
                        className={`kpi-card group cursor-pointer ${filter === 'all' ? 'ring-2 ring-[var(--accent)]' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-amber group-hover:scale-110 transition-transform">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value">{stats.total}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Products</p>
                            </div>
                        </div>
                    </div>

                    <div className="kpi-card group">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-green group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--success)' }}>{stats.inStock}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>In Stock</p>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`kpi-card group cursor-pointer ${filter === 'low' ? 'ring-2 ring-[var(--warning)]' : ''}`}
                        onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-orange group-hover:scale-110 transition-transform">
                                <TrendingDown className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--warning)' }}>{stats.lowStock}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Low Stock</p>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`kpi-card group cursor-pointer ${filter === 'out' ? 'ring-2 ring-[var(--danger)]' : ''}`}
                        onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
                    >
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-red group-hover:scale-110 transition-transform">
                                <XCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--danger)' }}>{stats.outOfStock}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Out of Stock</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alert Banner */}
                {stats.outOfStock > 0 && (
                    <div
                        className="animate-slide-up delay-3 p-4 rounded-2xl flex items-center gap-4"
                        style={{
                            background: 'var(--danger-light)',
                            border: '1px solid var(--danger)',
                            boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
                        }}
                    >
                        <div
                            className="p-3 rounded-xl"
                            style={{ background: 'var(--danger)', color: '#fff' }}
                        >
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="font-display font-semibold" style={{ color: 'var(--danger)' }}>
                                Attention Required
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {stats.outOfStock} product(s) are out of stock and need restocking
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFilter('out')}
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                            View Items
                        </Button>
                    </div>
                )}

                {/* Search and Filters */}
                <div className="flex gap-4 animate-slide-up delay-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="pl-11"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value as any); setPage(1); }}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                    >
                        <option value="all">All Stock Levels</option>
                        <option value="low">Low Stock (&lt;{LOW_STOCK_THRESHOLD})</option>
                        <option value="out">Out of Stock</option>
                    </select>
                </div>

                {/* Inventory Table */}
                <div
                    className="rounded-2xl overflow-hidden animate-slide-up delay-5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>
                                    <div className="flex items-center gap-2">
                                        Available Stock
                                        <ArrowUpDown className="w-3 h-3" />
                                    </div>
                                </th>
                                <th>Reorder Level</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState type="products" title="No products found" description="Try adjusting your filters" />
                                    </td>
                                </tr>
                            ) : (
                                paginatedProducts.map((product, index) => {
                                    const isLowStock = product.stock > 0 && product.stock < LOW_STOCK_THRESHOLD;
                                    const isOutOfStock = product.stock === 0;
                                    const needsReorder = product.stock <= REORDER_LEVEL;

                                    return (
                                        <tr
                                            key={product._id}
                                            className="animate-fade-in"
                                            style={{
                                                animationDelay: `${index * 0.03}s`,
                                                background: isOutOfStock ? 'rgba(239, 68, 68, 0.05)' : isLowStock ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                                            }}
                                        >
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-11 h-11 rounded-xl object-cover"
                                                            style={{ border: '1px solid var(--border)' }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-11 h-11 rounded-xl flex items-center justify-center"
                                                            style={{ background: 'var(--bg-tertiary)' }}
                                                        >
                                                            <Package className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{product.unit}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                {typeof product.categoryId === 'object' ? product.categoryId?.name : '-'}
                                            </td>
                                            <td>
                                                <span
                                                    className="text-xl font-display font-bold"
                                                    style={{
                                                        color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--text-primary)'
                                                    }}
                                                >
                                                    {product.stock}
                                                </span>
                                                <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>units</span>
                                            </td>
                                            <td>
                                                <span style={{ color: 'var(--text-secondary)' }}>{REORDER_LEVEL} units</span>
                                                {needsReorder && (
                                                    <Badge variant="warning" className="ml-2 text-[10px]">Reorder</Badge>
                                                )}
                                            </td>
                                            <td>
                                                {isOutOfStock ? (
                                                    <Badge variant="destructive">
                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                        Out of Stock
                                                    </Badge>
                                                ) : isLowStock ? (
                                                    <Badge variant="warning">
                                                        <TrendingDown className="w-3 h-3 mr-1" />
                                                        Low Stock
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="success">In Stock</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {filteredProducts.length > 0 && (
                        <div
                            className="flex items-center justify-between px-6 py-4"
                            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                        >
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="px-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
