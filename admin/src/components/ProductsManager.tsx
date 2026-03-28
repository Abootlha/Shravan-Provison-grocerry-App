import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/Skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { EmptyState } from './ui/EmptyState';
import {
    Plus, Pencil, Search, Package, X, Scan, Camera, StopCircle, Upload, Link, ImageIcon,
    Filter, ChevronLeft, ChevronRight, MoreHorizontal, Eye, Trash2, CheckCircle, XCircle, Boxes
} from 'lucide-react';

type Html5QrcodeInstance = {
    start: (
        cameraConfig: { facingMode: string },
        config: { fps: number; qrbox: { width: number; height: number } },
        onSuccess: (decodedText: string) => void,
        onError?: (errorMessage: string) => void
    ) => Promise<void>;
    stop: () => Promise<void>;
};

interface Product {
    _id: string;
    name: string;
    price: number;
    originalPrice: number;
    unit: string;
    stock: number;
    isAvailable: boolean;
    barcode?: string;
    image?: string;
    description?: string;
    brand?: string;
    gst?: number;
    shelfLife?: number;
    storageType?: string;
    nutrition?: {
        protein?: number;
        carbs?: number;
        sugar?: number;
        fat?: number;
        transFat?: number;
    };
    categoryId: { _id: string; name: string; type?: string } | string;
}

interface Category {
    _id: string;
    name: string;
    type: 'beverage' | 'non-beverage';
}

// Unit options based on category type
const BEVERAGE_UNITS = ['100ml', '200ml', '250ml', '500ml', '750ml', '1L', '1.5L', '2L', '5L'];
const NON_BEVERAGE_UNITS = [
    '50g', '100g', '200g', '250g', '500g', '1kg', '2kg', '5kg', '10kg',
    '50ml', '100ml', '200ml', '250ml', '500ml', '1L', '2L', '5L',
    '1pc', '2pcs', '3pcs', '6pcs', '12pcs', '1 dozen',
    '1 pack', '2 pack', '6 pack'
];

const STORAGE_TYPES = ['Ambient', 'Refrigerated', 'Frozen'];

export default function ProductsManager() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
    const [activeTab, setActiveTab] = useState('basic');
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Scanner
    const [showScanner, setShowScanner] = useState(false);
    const [scannerReady, setScannerReady] = useState(false);
    const [imageMode, setImageMode] = useState<'url' | 'file'>('url');
    const [imagePreview, setImagePreview] = useState<string>('');
    const scannerRef = useRef<Html5QrcodeInstance | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: '', price: '', originalPrice: '', unit: '', stock: '', categoryId: '',
        subcategoryId: '', itemGroupId: '',  // NEW
        description: '', image: '', barcode: '', customUnit: '', brand: '',
        mrp: '', gst: '', shelfLife: '', storageType: '',
        protein: '', carbs: '', sugar: '', fat: '', transFat: ''
    });

    const [availableSubcategories, setAvailableSubcategories] = useState<Category[]>([]);
    const [availableItemGroups, setAvailableItemGroups] = useState<any[]>([]);

    const selectedCategory = categories.find(c => c._id === form.categoryId);
    const unitOptions = selectedCategory?.type === 'beverage' ? BEVERAGE_UNITS : NON_BEVERAGE_UNITS;

    useEffect(() => {
        fetchData();
    }, [categoryFilter, page]);

    // Fetch subcategories when category changes
    useEffect(() => {
        if (form.categoryId) {
            api.getSubcategories(form.categoryId).then(data => {
                setAvailableSubcategories(data.subcategories || []);
                // Reset subcategory and item group when category changes
                if (form.subcategoryId) {
                    setForm(prev => ({ ...prev, subcategoryId: '', itemGroupId: '' }));
                }
            }).catch(err => {
                console.error('Error fetching subcategories:', err);
                setAvailableSubcategories([]);
            });
        } else {
            setAvailableSubcategories([]);
            setAvailableItemGroups([]);
        }
    }, [form.categoryId]);

    // Fetch item groups when subcategory changes
    useEffect(() => {
        if (form.subcategoryId) {
            api.getItemGroups(form.subcategoryId).then(data => {
                setAvailableItemGroups(data.itemGroups || []);
                // Reset item group when subcategory changes
                if (form.itemGroupId) {
                    setForm(prev => ({ ...prev, itemGroupId: '' }));
                }
            }).catch(err => {
                console.error('Error fetching item groups:', err);
                setAvailableItemGroups([]);
            });
        } else {
            setAvailableItemGroups([]);
        }
    }, [form.subcategoryId]);

    async function fetchData() {
        try {
            const [productsData, categoriesData] = await Promise.all([
                api.getProducts({ categoryId: categoryFilter || undefined, limit: 100 }),
                api.getCategories(),
            ]);
            setProducts(productsData.products || []);
            setTotalPages(Math.ceil((productsData.products?.length || 0) / ITEMS_PER_PAGE));
            setCategories(categoriesData.categories || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    function openAddModal() {
        setEditProduct(null);
        setActiveTab('basic');
        setForm({
            name: '', price: '', originalPrice: '', unit: '', stock: '', categoryId: '',
            subcategoryId: '', itemGroupId: '',
            description: '', image: '', barcode: '', customUnit: '', brand: '',
            mrp: '', gst: '', shelfLife: '', storageType: '',
            protein: '', carbs: '', sugar: '', fat: '', transFat: ''
        });
        setImagePreview('');
        setImageMode('url');
        setAvailableSubcategories([]);
        setAvailableItemGroups([]);
        setShowModal(true);
    }

    function openEditModal(product: Product) {
        setEditProduct(product);
        setActiveTab('basic');
        const categoryId = typeof product.categoryId === 'string' ? product.categoryId : product.categoryId?._id || '';
        setForm({
            name: product.name,
            price: String(product.price),
            originalPrice: String(product.originalPrice || ''),
            mrp: String(product.originalPrice || ''),
            unit: product.unit,
            stock: String(product.stock),
            categoryId,
            subcategoryId: (product as any).subcategoryId?._id || (product as any).subcategoryId || '',
            itemGroupId: (product as any).itemGroupId?._id || (product as any).itemGroupId || '',
            description: product.description || '',
            image: product.image || '',
            customUnit: '',
            barcode: product.barcode || '',
            brand: product.brand || '',
            gst: String(product.gst || ''),
            shelfLife: String(product.shelfLife || ''),
            storageType: product.storageType || '',
            protein: String(product.nutrition?.protein || ''),
            carbs: String(product.nutrition?.carbs || ''),
            sugar: String(product.nutrition?.sugar || ''),
            fat: String(product.nutrition?.fat || ''),
            transFat: String(product.nutrition?.transFat || ''),
        });
        setImagePreview(product.image || '');
        setImageMode('url');
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            // Validate required hierarchy fields
            if (!form.categoryId) {
                alert('Please select a category');
                return;
            }
            if (!form.subcategoryId) {
                alert('Please select a subcategory');
                return;
            }
            if (!form.itemGroupId) {
                alert('Please select an item group');
                return;
            }

            const finalUnit = form.unit === 'custom' ? form.customUnit : form.unit;
            const data = {
                name: form.name,
                price: Number(form.price),
                originalPrice: Number(form.mrp) || Number(form.price),
                unit: finalUnit,
                stock: Number(form.stock),
                categoryId: form.categoryId,
                subcategoryId: form.subcategoryId,
                itemGroupId: form.itemGroupId,
                barcode: form.barcode,
                description: form.description,
                image: form.image || imagePreview,
                brand: form.brand,
                gst: Number(form.gst) || 0,
                shelfLife: Number(form.shelfLife) || 0,
                storageType: form.storageType,
                nutrition: {
                    protein: Number(form.protein) || 0,
                    carbs: Number(form.carbs) || 0,
                    sugar: Number(form.sugar) || 0,
                    fat: Number(form.fat) || 0,
                    transFat: Number(form.transFat) || 0,
                },
                isAvailable: true,
            };
            if (editProduct?._id) {
                await api.updateProduct(editProduct._id, data);
            } else {
                await api.createProduct(data);
            }
            setShowModal(false);
            fetchData();
        } catch (error: any) {
            console.error('Error saving product:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            alert(`Error saving product: ${errorMessage}`);
        }
    }

    function handleImageUrlChange(url: string) {
        setForm({ ...form, image: url });
        setImagePreview(url);
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setImagePreview(base64);
                setForm({ ...form, image: base64 });
            };
            reader.readAsDataURL(file);
        }
    }

    function clearImage() {
        setImagePreview('');
        setForm({ ...form, image: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function startScanner() {
        setShowScanner(true);
        setScannerReady(false);
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            scannerRef.current = new Html5Qrcode('barcode-reader');
            await scannerRef.current.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 100 } },
                onScanSuccess,
                () => { }
            );
            setScannerReady(true);
        } catch (err) {
            console.error('Scanner failed to start:', err);
            alert('Could not access camera.');
            setShowScanner(false);
        }
    }

    async function stopScanner() {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); scannerRef.current = null; } catch { }
        }
        setShowScanner(false);
        setScannerReady(false);
    }

    async function onScanSuccess(barcode: string) {
        await stopScanner();
        setForm(prev => ({ ...prev, barcode }));
    }

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode && p.barcode.includes(search));
        const matchesStock = stockFilter === 'all' ||
            (stockFilter === 'out-of-stock' && p.stock === 0) ||
            (stockFilter === 'low-stock' && p.stock > 0 && p.stock < 10) ||
            (stockFilter === 'in-stock' && p.stock >= 10);
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && p.isAvailable) ||
            (statusFilter === 'inactive' && !p.isAvailable);
        return matchesSearch && matchesStock && matchesStatus;
    });

    const paginatedProducts = filteredProducts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const actualTotalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <div className="flex justify-between">
                        <Skeleton className="h-12 w-64" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div className="p-4 space-y-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                    <Skeleton className="h-6 w-20" />
                                    <Skeleton className="h-6 w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-bg min-h-screen">
            <div className="relative z-10 p-6 lg:p-8 space-y-8">

                {/* Hero Header */}
                <div className="animate-slide-up delay-1">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Boxes className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Product Catalog
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Products
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                {products.length} products in your catalog
                            </p>
                        </div>
                        <Button onClick={openAddModal}>
                            <Plus className="w-4 h-4 mr-2" /> Add Product
                        </Button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col gap-4 animate-slide-up delay-2">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            <Input
                                placeholder="Search products or barcode..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pl-11"
                            />
                        </div>
                        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                            <Filter className="w-4 h-4 mr-2" />
                            Filters
                            {(categoryFilter || stockFilter !== 'all' || statusFilter !== 'all') && (
                                <span className="ml-2 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>
                                    {[categoryFilter, stockFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
                                </span>
                            )}
                        </Button>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div
                            className="p-5 rounded-2xl animate-scale-in"
                            style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Category</label>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                                    >
                                        <option value="">All Categories</option>
                                        {categories.map((cat) => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Stock Status</label>
                                    <select
                                        value={stockFilter}
                                        onChange={(e) => { setStockFilter(e.target.value as any); setPage(1); }}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                                    >
                                        <option value="all">All</option>
                                        <option value="in-stock">In Stock (10+)</option>
                                        <option value="low-stock">Low Stock (&lt;10)</option>
                                        <option value="out-of-stock">Out of Stock</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Status</label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                                    >
                                        <option value="all">All</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter(''); setStockFilter('all'); setStatusFilter('all'); }}>
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Products Table */}
                <div
                    className="rounded-2xl overflow-hidden animate-slide-up delay-3"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                    <div className="overflow-x-auto">
                        <table className="modern-table min-w-[900px]">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Brand</th>
                                    <th>Hierarchy</th>
                                    <th>Unit</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8}>
                                            <EmptyState
                                                type="products"
                                                action={
                                                    <Button onClick={openAddModal}>
                                                        <Plus className="w-4 h-4 mr-2" /> Add First Product
                                                    </Button>
                                                }
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedProducts.map((product, index) => (
                                        <tr
                                            key={product._id}
                                            className="animate-fade-in"
                                            style={{ animationDelay: `${index * 0.03}s` }}
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
                                                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
                                                        {product.barcode && (
                                                            <code className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{product.barcode}</code>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{product.brand || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                            <td>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                                        {typeof product.categoryId === 'object' ? product.categoryId?.name : '-'}
                                                    </span>
                                                    {(product as any).subcategoryId && (
                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                            → {typeof (product as any).subcategoryId === 'object' ? (product as any).subcategoryId?.name : '-'}
                                                        </span>
                                                    )}
                                                    {(product as any).itemGroupId && (
                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                            → {typeof (product as any).itemGroupId === 'object' ? (product as any).itemGroupId?.name : '-'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{product.unit}</td>
                                            <td>
                                                <span className="font-semibold" style={{ color: 'var(--accent)' }}>₹{product.price}</span>
                                                {product.originalPrice > product.price && (
                                                    <span className="text-xs line-through ml-1" style={{ color: 'var(--text-muted)' }}>₹{product.originalPrice}</span>
                                                )}
                                            </td>
                                            <td>
                                                <Badge
                                                    variant={product.stock === 0 ? 'destructive' : product.stock < 10 ? 'warning' : 'success'}
                                                >
                                                    {product.stock} units
                                                </Badge>
                                            </td>
                                            <td>
                                                {product.isAvailable ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                                                        style={{ background: 'var(--success-light)', color: 'var(--success)' }}
                                                    >
                                                        <CheckCircle className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                                    >
                                                        <XCircle className="w-3 h-3" /> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewProduct(product); setShowViewModal(true); }}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(product)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredProducts.length > 0 && (
                        <div
                            className="flex items-center justify-between px-6 py-4"
                            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}
                        >
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                {[...Array(Math.min(5, actualTotalPages))].map((_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? 'default' : 'outline'}
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setPage(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage(p => Math.min(actualTotalPages, p + 1))}
                                    disabled={page === actualTotalPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Add/Edit Modal with Tabs */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
                        <Card className="w-full max-w-2xl mx-4 shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                                <CardTitle className="text-lg">{editProduct ? 'Edit Product' : 'Add New Product'}</CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowModal(false); stopScanner(); }}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <form onSubmit={handleSubmit}>
                                    <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab}>
                                        <div className="px-6 pt-4" style={{ borderBottom: '1px solid var(--border)' }}>
                                            <TabsList className="w-full justify-start p-0 gap-0">
                                                <TabsTrigger value="basic">
                                                    Basic Info
                                                </TabsTrigger>
                                                <TabsTrigger value="pricing">
                                                    Pricing
                                                </TabsTrigger>
                                                <TabsTrigger value="inventory">
                                                    Inventory
                                                </TabsTrigger>
                                                <TabsTrigger value="nutrition">
                                                    Nutrition
                                                </TabsTrigger>
                                                <TabsTrigger value="images">
                                                    Images
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                                            {/* Basic Info Tab */}
                                            <TabsContent value="basic" className="mt-0 space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Product Name *</label>
                                                    <Input
                                                        placeholder="Enter product name"
                                                        value={form.name}
                                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                        required
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Brand</label>
                                                        <Input
                                                            placeholder="Brand name"
                                                            value={form.brand}
                                                            onChange={(e) => setForm({ ...form, brand: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Barcode (EAN/UPC)</label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                placeholder="Scan or enter barcode"
                                                                value={form.barcode}
                                                                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                                                            />
                                                            <Button type="button" variant="outline" size="icon" onClick={startScanner}>
                                                                <Scan className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {showScanner && (
                                                    <div className="rounded-lg p-3" style={{ border: '1px solid var(--border)' }}>
                                                        <div id="barcode-reader" style={{ width: '100%' }}></div>
                                                        {!scannerReady && <p className="text-sm text-center mt-2" style={{ color: 'var(--text-muted)' }}>Initializing camera...</p>}
                                                        <Button type="button" variant="destructive" size="sm" onClick={stopScanner} className="mt-2 w-full">
                                                            <StopCircle className="w-4 h-4 mr-2" /> Stop Scanner
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Hierarchy Selection - 3 columns */}
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Category *</label>
                                                        <select
                                                            value={form.categoryId}
                                                            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                            required
                                                        >
                                                            <option value="">Select Category</option>
                                                            {categories.map((cat) => (
                                                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Subcategory *</label>
                                                        <select
                                                            value={form.subcategoryId}
                                                            onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
                                                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                            required
                                                            disabled={!form.categoryId}
                                                        >
                                                            <option value="">Select Subcategory</option>
                                                            {availableSubcategories.map((sub) => (
                                                                <option key={sub._id} value={sub._id}>{sub.name}</option>
                                                            ))}
                                                        </select>
                                                        {!form.categoryId && (
                                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Select a category first</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Item Group *</label>
                                                        <select
                                                            value={form.itemGroupId}
                                                            onChange={(e) => setForm({ ...form, itemGroupId: e.target.value })}
                                                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                            required
                                                            disabled={!form.subcategoryId}
                                                        >
                                                            <option value="">Select Item Group</option>
                                                            {availableItemGroups.map((ig) => (
                                                                <option key={ig._id} value={ig._id}>{ig.name}</option>
                                                            ))}
                                                        </select>
                                                        {!form.subcategoryId && (
                                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Select a subcategory first</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Hierarchy Breadcrumb */}
                                                {form.categoryId && (
                                                    <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                        <span>{categories.find(c => c._id === form.categoryId)?.name}</span>
                                                        {form.subcategoryId && (
                                                            <>
                                                                <span>→</span>
                                                                <span>{availableSubcategories.find(s => s._id === form.subcategoryId)?.name}</span>
                                                            </>
                                                        )}
                                                        {form.itemGroupId && (
                                                            <>
                                                                <span>→</span>
                                                                <span>{availableItemGroups.find(ig => ig._id === form.itemGroupId)?.name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Unit Selection - Separate row */}
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Unit *</label>
                                                    <select
                                                        value={form.unit}
                                                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                                        className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                        required
                                                        disabled={!form.categoryId}
                                                    >
                                                        <option value="">Select Unit</option>
                                                        {unitOptions.map((unit) => (
                                                            <option key={unit} value={unit}>{unit}</option>
                                                        ))}
                                                        <option value="custom">Custom...</option>
                                                    </select>
                                                </div>

                                                {form.unit === 'custom' && (
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Custom Unit</label>
                                                        <Input
                                                            placeholder="e.g., 150ml, 750g, 3pcs"
                                                            value={form.customUnit}
                                                            onChange={(e) => setForm({ ...form, customUnit: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
                                                    <textarea
                                                        placeholder="Product description..."
                                                        value={form.description}
                                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-none"
                                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                        rows={3}
                                                    />
                                                </div>
                                            </TabsContent>

                                            {/* Pricing Tab */}
                                            <TabsContent value="pricing" className="mt-0 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>MRP (₹) *</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Maximum Retail Price"
                                                            value={form.mrp}
                                                            onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Selling Price (₹) *</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Your selling price"
                                                            value={form.price}
                                                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>GST %</label>
                                                    <select
                                                        value={form.gst}
                                                        onChange={(e) => setForm({ ...form, gst: e.target.value })}
                                                        className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                    >
                                                        <option value="">No GST</option>
                                                        <option value="5">5%</option>
                                                        <option value="12">12%</option>
                                                        <option value="18">18%</option>
                                                        <option value="28">28%</option>
                                                    </select>
                                                </div>
                                                {form.mrp && form.price && Number(form.mrp) > Number(form.price) && (
                                                    <div className="rounded-lg p-3" style={{ background: 'var(--success-light)', border: '1px solid var(--success)' }}>
                                                        <p className="text-sm" style={{ color: 'var(--success)' }}>
                                                            <strong>Discount:</strong> {Math.round((1 - Number(form.price) / Number(form.mrp)) * 100)}% off
                                                        </p>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            {/* Inventory Tab */}
                                            <TabsContent value="inventory" className="mt-0 space-y-4">
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Stock Quantity *</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="Available stock"
                                                        value={form.stock}
                                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Shelf Life (days)</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="e.g., 30, 90, 365"
                                                            value={form.shelfLife}
                                                            onChange={(e) => setForm({ ...form, shelfLife: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Storage Type</label>
                                                        <select
                                                            value={form.storageType}
                                                            onChange={(e) => setForm({ ...form, storageType: e.target.value })}
                                                            className="w-full h-10 px-3 rounded-xl text-sm focus:outline-none"
                                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                                        >
                                                            <option value="">Select storage type</option>
                                                            {STORAGE_TYPES.map((type) => (
                                                                <option key={type} value={type}>{type}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Nutrition Tab */}
                                            <TabsContent value="nutrition" className="mt-0 space-y-4">
                                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nutritional information per 100g/100ml</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Protein (g)</label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="0.0"
                                                            value={form.protein}
                                                            onChange={(e) => setForm({ ...form, protein: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Carbohydrates (g)</label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="0.0"
                                                            value={form.carbs}
                                                            onChange={(e) => setForm({ ...form, carbs: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Sugar (g)</label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="0.0"
                                                            value={form.sugar}
                                                            onChange={(e) => setForm({ ...form, sugar: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Fat (g)</label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="0.0"
                                                            value={form.fat}
                                                            onChange={(e) => setForm({ ...form, fat: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Trans Fat (g)</label>
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            placeholder="0.0"
                                                            value={form.transFat}
                                                            onChange={(e) => setForm({ ...form, transFat: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </TabsContent>

                                            {/* Images Tab */}
                                            <TabsContent value="images" className="mt-0 space-y-4">
                                                {imagePreview && (
                                                    <div className="relative">
                                                        <img
                                                            src={imagePreview}
                                                            alt="Preview"
                                                            className="w-full h-48 object-contain rounded-lg"
                                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-2 right-2 h-8 w-8"
                                                            onClick={clearImage}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageMode('url')}
                                                        className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                                        style={{
                                                            background: imageMode === 'url' ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                                                            color: imageMode === 'url' ? 'var(--accent)' : 'var(--text-muted)',
                                                            border: imageMode === 'url' ? '2px solid var(--accent)' : '2px solid transparent'
                                                        }}
                                                    >
                                                        <Link className="w-4 h-4" /> Image URL
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageMode('file')}
                                                        className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                                                        style={{
                                                            background: imageMode === 'file' ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                                                            color: imageMode === 'file' ? 'var(--accent)' : 'var(--text-muted)',
                                                            border: imageMode === 'file' ? '2px solid var(--accent)' : '2px solid transparent'
                                                        }}
                                                    >
                                                        <Upload className="w-4 h-4" /> Upload File
                                                    </button>
                                                </div>

                                                {imageMode === 'url' && (
                                                    <Input
                                                        placeholder="https://example.com/image.jpg"
                                                        value={form.image}
                                                        onChange={(e) => handleImageUrlChange(e.target.value)}
                                                    />
                                                )}

                                                {imageMode === 'file' && (
                                                    <div>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleFileSelect}
                                                            className="hidden"
                                                            id="image-upload"
                                                        />
                                                        <label
                                                            htmlFor="image-upload"
                                                            className="flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors"
                                                            style={{ borderColor: 'var(--border)', background: 'transparent' }}
                                                        >
                                                            <Upload className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                                                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Click to upload image</span>
                                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PNG, JPG up to 5MB</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </TabsContent>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
                                            <div className="flex gap-1">
                                                {['basic', 'pricing', 'inventory', 'nutrition', 'images'].map((tab, i) => (
                                                    <div
                                                        key={tab}
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ background: activeTab === tab ? 'var(--accent)' : 'var(--bg-elevated)' }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex gap-3">
                                                <Button type="button" variant="outline" onClick={() => { setShowModal(false); stopScanner(); }}>
                                                    Cancel
                                                </Button>
                                                <Button type="submit">
                                                    {editProduct ? 'Save Changes' : 'Add Product'}
                                                </Button>
                                            </div>
                                        </div>
                                    </Tabs>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* View Product Modal */}
            {showViewModal && viewProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
                    <Card className="w-full max-w-3xl mx-4 shadow-xl">
                        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                            <CardTitle className="text-lg">Product Details</CardTitle>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowViewModal(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Product Image */}
                                <div className="md:col-span-1">
                                    {viewProduct.image ? (
                                        <img
                                            src={viewProduct.image}
                                            alt={viewProduct.name}
                                            className="w-full aspect-square object-contain rounded-xl"
                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                                        />
                                    ) : (
                                        <div
                                            className="w-full aspect-square rounded-xl flex items-center justify-center"
                                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                                        >
                                            <Package className="w-16 h-16" style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    )}
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Status</span>
                                            {viewProduct.isAvailable ? (
                                                <Badge variant="success">Active</Badge>
                                            ) : (
                                                <Badge variant="destructive">Inactive</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Stock</span>
                                            <Badge variant={viewProduct.stock === 0 ? 'destructive' : viewProduct.stock < 10 ? 'warning' : 'success'}>
                                                {viewProduct.stock} units
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Product Information */}
                                <div className="md:col-span-2 space-y-6">
                                    {/* Basic Info */}
                                    <div>
                                        <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{viewProduct.name}</h3>
                                        {viewProduct.brand && (
                                            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>by {viewProduct.brand}</p>
                                        )}
                                        {viewProduct.barcode && (
                                            <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                                {viewProduct.barcode}
                                            </code>
                                        )}
                                    </div>

                                    {/* Hierarchy */}
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Category Hierarchy</h4>
                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                            <Badge variant="outline">
                                                {typeof viewProduct.categoryId === 'object' ? viewProduct.categoryId?.name : 'N/A'}
                                            </Badge>
                                            {(viewProduct as any).subcategoryId && (
                                                <>
                                                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                    <Badge variant="outline">
                                                        {typeof (viewProduct as any).subcategoryId === 'object' ? (viewProduct as any).subcategoryId?.name : 'N/A'}
                                                    </Badge>
                                                </>
                                            )}
                                            {(viewProduct as any).itemGroupId && (
                                                <>
                                                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                    <Badge variant="outline">
                                                        {typeof (viewProduct as any).itemGroupId === 'object' ? (viewProduct as any).itemGroupId?.name : 'N/A'}
                                                    </Badge>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Selling Price</p>
                                            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>₹{viewProduct.price}</p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>per {viewProduct.unit}</p>
                                        </div>
                                        {viewProduct.originalPrice && viewProduct.originalPrice > viewProduct.price && (
                                            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>MRP</p>
                                                <p className="text-2xl font-bold line-through" style={{ color: 'var(--text-secondary)' }}>₹{viewProduct.originalPrice}</p>
                                                <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--success)' }}>
                                                    {Math.round((1 - viewProduct.price / viewProduct.originalPrice) * 100)}% OFF
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    {viewProduct.description && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Description</h4>
                                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{viewProduct.description}</p>
                                        </div>
                                    )}

                                    {/* Additional Details */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {viewProduct.gst && viewProduct.gst > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>GST</p>
                                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewProduct.gst}%</p>
                                            </div>
                                        )}
                                        {viewProduct.shelfLife && viewProduct.shelfLife > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Shelf Life</p>
                                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewProduct.shelfLife} days</p>
                                            </div>
                                        )}
                                        {viewProduct.storageType && (
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Storage</p>
                                                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{viewProduct.storageType}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Nutrition Info */}
                                    {viewProduct.nutrition && (
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Nutritional Information (per 100g/100ml)</h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                {viewProduct.nutrition.protein && viewProduct.nutrition.protein > 0 && (
                                                    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Protein</p>
                                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewProduct.nutrition.protein}g</p>
                                                    </div>
                                                )}
                                                {viewProduct.nutrition.carbs && viewProduct.nutrition.carbs > 0 && (
                                                    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Carbs</p>
                                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewProduct.nutrition.carbs}g</p>
                                                    </div>
                                                )}
                                                {viewProduct.nutrition.sugar && viewProduct.nutrition.sugar > 0 && (
                                                    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Sugar</p>
                                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewProduct.nutrition.sugar}g</p>
                                                    </div>
                                                )}
                                                {viewProduct.nutrition.fat && viewProduct.nutrition.fat > 0 && (
                                                    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Fat</p>
                                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewProduct.nutrition.fat}g</p>
                                                    </div>
                                                )}
                                                {viewProduct.nutrition.transFat && viewProduct.nutrition.transFat > 0 && (
                                                    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Trans Fat</p>
                                                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{viewProduct.nutrition.transFat}g</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex justify-end gap-3 mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                                    Close
                                </Button>
                                <Button onClick={() => { setShowViewModal(false); openEditModal(viewProduct); }}>
                                    <Pencil className="w-4 h-4 mr-2" /> Edit Product
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
