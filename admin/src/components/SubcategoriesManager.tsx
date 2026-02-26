import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Plus, Pencil, Trash2, X, Search as SearchIcon, RefreshCw, ToggleLeft, ToggleRight, Sparkles, ChevronDown, Layers, Package } from 'lucide-react';

interface Category {
    _id: string;
    name: string;
    icon: string;
    color: string;
    type: 'category' | 'subcategory';
    parentId?: string;
    isActive: boolean;
}

// Reuse grocery icons from CategoriesManager
const GROCERY_ICONS = {
    'Fruits & Vegetables': [
        { id: 'twemoji:red-apple', name: 'Apple' },
        { id: 'twemoji:orange', name: 'Orange' },
        { id: 'twemoji:banana', name: 'Banana' },
        { id: 'twemoji:leafy-green', name: 'Vegetables' },
        { id: 'twemoji:tomato', name: 'Tomato' },
        { id: 'twemoji:carrot', name: 'Carrot' },
    ],
    'Dairy & Beverages': [
        { id: 'twemoji:glass-of-milk', name: 'Milk' },
        { id: 'twemoji:cheese-wedge', name: 'Cheese' },
        { id: 'twemoji:butter', name: 'Butter' },
        { id: 'twemoji:egg', name: 'Eggs' },
        { id: 'twemoji:beverage-box', name: 'Juice' },
        { id: 'twemoji:cup-with-straw', name: 'Cold Drink' },
    ],
    'Grocery': [
        { id: 'twemoji:sheaf-of-rice', name: 'Rice/Wheat' },
        { id: 'twemoji:bread', name: 'Bread' },
        { id: 'twemoji:cookie', name: 'Biscuits' },
        { id: 'twemoji:chocolate-bar', name: 'Chocolate' },
        { id: 'twemoji:honey-pot', name: 'Honey' },
        { id: 'twemoji:salt', name: 'Salt' },
    ],
};

export default function SubcategoriesManager() {
    const [parentCategories, setParentCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editSubcategory, setEditSubcategory] = useState<Category | null>(null);
    const [search, setSearch] = useState('');
    const [selectedParent, setSelectedParent] = useState<string>('');
    const [imagePreview, setImagePreview] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: '',
        icon: '',
        color: '#3b82f6',
        parentId: '',
        iconType: 'url' as 'url' | 'upload',
        iconUrl: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            // Fetch parent categories (main categories only)
            const catRes = await api.getCategories();
            const mainCats = catRes.categories || [];

            // Fetch subcategories from the new subcategories collection
            const subRes = await api.getAllSubcategories();
            const subCats = subRes.subcategories || [];

            setParentCategories(mainCats);
            setSubcategories(subCats);
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

    function openAddModal() {
        setEditSubcategory(null);
        setForm({
            name: '',
            icon: '',
            color: '#3b82f6',
            parentId: selectedParent || (parentCategories[0]?._id || ''),
            iconType: 'url',
            iconUrl: ''
        });
        setImagePreview('');
        setShowModal(true);
    }

    function openEditModal(subcategory: Category) {
        setEditSubcategory(subcategory);
        const isUrl = subcategory.icon?.startsWith('http');
        setForm({
            name: subcategory.name,
            icon: isUrl ? '' : (subcategory.icon || ''),
            color: subcategory.color || '#3b82f6',
            parentId: subcategory.parentId || '',
            iconType: 'url',
            iconUrl: isUrl ? subcategory.icon : ''
        });
        setImagePreview(isUrl ? subcategory.icon : '');
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const iconValue = form.iconType === 'url' ? form.iconUrl : (imagePreview || form.icon);
            const data = {
                name: form.name,
                icon: iconValue,
                color: form.color,
                parentId: form.parentId,
                isActive: true,
            };

            if (editSubcategory?._id) {
                await api.updateSubcategory(editSubcategory._id, data);
            } else {
                await api.createSubcategory(data);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            alert('Error saving subcategory');
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size and compress if needed
            if (file.size > 100 * 1024) {
                // Compress image if larger than 100KB
                compressImage(file, (compressedBase64) => {
                    setImagePreview(compressedBase64);
                    setForm({ ...form, icon: compressedBase64 });
                });
            } else {
                // File is small enough, use as-is
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    setImagePreview(base64);
                    setForm({ ...form, icon: base64 });
                };
                reader.readAsDataURL(file);
            }
        }
    }

    function compressImage(file: File, callback: (base64: string) => void) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for compression
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 200x200 for subcategory icons)
                let width = img.width;
                let height = img.height;
                const maxSize = 200;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 with quality reduction
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                
                // Check final size
                const sizeKB = Math.round((compressedBase64.length * 3) / 4 / 1024);
                console.log(`Image compressed: ${Math.round(file.size / 1024)}KB → ${sizeKB}KB`);
                
                callback(compressedBase64);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    function clearImage() {
        setImagePreview('');
        setForm({ ...form, icon: '', iconUrl: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this subcategory?')) return;
        try {
            await api.deleteSubcategory(id);
            fetchData();
        } catch (error) {
            alert('Error deleting subcategory');
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            await api.updateCategory(id, { isActive: !currentStatus });
            fetchData();
        } catch (error) {
            alert('Error updating subcategory');
        }
    }

    const getFilteredIcons = (): Record<string, { id: string; name: string }[]> => {
        return GROCERY_ICONS;
    };

    const getParentName = (parentId: string | any) => {
        // Handle if parentId is an object (populated)
        if (typeof parentId === 'object' && parentId?._id) {
            return parentId.name || 'Unknown';
        }
        // Handle if parentId is a string
        const parent = parentCategories.find(c => c._id === parentId);
        return parent?.name || 'Unknown';
    };

    const getParentColor = (parentId: string | any) => {
        // Handle if parentId is an object (populated)
        if (typeof parentId === 'object' && parentId?._id) {
            return parentId.color || '#666';
        }
        // Handle if parentId is a string
        const parent = parentCategories.find(c => c._id === parentId);
        return parent?.color || '#666';
    };

    const filteredSubcategories = subcategories.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
        const matchesParent = !selectedParent || c.parentId === selectedParent;
        return matchesSearch && matchesParent;
    });

    const stats = {
        total: subcategories.length,
        active: subcategories.filter(c => c.isActive).length,
    };

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <div className="flex justify-between">
                        <Skeleton className="h-12 w-64" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
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
                                <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Step 2: Subcategories
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Subcategories
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                Link subcategories to parent categories
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button onClick={openAddModal}>
                                <Plus className="w-4 h-4 mr-2" /> Add Subcategory
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up delay-2">
                    <div className="kpi-card">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-blue">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value">{stats.total}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Subcategories</p>
                            </div>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-green">
                                <ToggleRight className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--success)' }}>{stats.active}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Active</p>
                            </div>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-amber">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--warning)' }}>{parentCategories.length}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Parent Categories</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 animate-slide-up delay-3">
                    <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search subcategories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11"
                        />
                    </div>
                    <select
                        value={selectedParent}
                        onChange={(e) => setSelectedParent(e.target.value)}
                        className="px-4 py-2 rounded-xl border transition-colors"
                        style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <option value="">All Parent Categories</option>
                        {parentCategories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                    </select>
                    {selectedParent && (
                        <Button variant="ghost" onClick={() => setSelectedParent('')}>
                            <X className="w-4 h-4 mr-2" />
                            Clear filter
                        </Button>
                    )}
                </div>

                {/* Subcategory Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredSubcategories.length === 0 ? (
                        <div className="col-span-full animate-slide-up delay-4">
                            <EmptyState
                                type="categories"
                                title="No subcategories found"
                                description={search ? "Try a different search term" : "Create your first subcategory"}
                                action={!search && (
                                    <Button onClick={openAddModal}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Subcategory
                                    </Button>
                                )}
                            />
                        </div>
                    ) : (
                        filteredSubcategories.map((subcategory, index) => (
                            <div
                                key={subcategory._id}
                                className="group animate-slide-up"
                                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                            >
                                <div
                                    className="relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderColor: 'var(--border)',
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = subcategory.color + '60';
                                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${subcategory.color}20`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                    }}
                                >
                                    <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: subcategory.color }}
                                    />

                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 overflow-hidden"
                                            style={{
                                                backgroundColor: subcategory.color + '18',
                                                border: `1px solid ${subcategory.color}30`
                                            }}
                                        >
                                            {subcategory.icon?.startsWith('http') ? (
                                                <img src={subcategory.icon} alt={subcategory.name} className="w-8 h-8 object-contain" />
                                            ) : (
                                                <Package className="w-8 h-8" style={{ color: subcategory.color }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-display font-semibold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
                                                {subcategory.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge
                                                    variant="outline"
                                                    style={{
                                                        borderColor: getParentColor(subcategory.parentId || '') + '50',
                                                        color: getParentColor(subcategory.parentId || '')
                                                    }}
                                                >
                                                    {getParentName(subcategory.parentId || '')}
                                                </Badge>
                                                <Badge variant={subcategory.isActive ? 'success' : 'secondary'}>
                                                    {subcategory.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                            <button
                                                onClick={() => openEditModal(subcategory)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleActive(subcategory._id, subcategory.isActive)}
                                                className="p-2 rounded-lg transition-colors"
                                            >
                                                {subcategory.isActive ? (
                                                    <ToggleRight className="w-4 h-4" style={{ color: 'var(--success)' }} />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(subcategory._id)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--danger)' }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal */}
                {showModal && (
                    <div
                        className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto py-8"
                        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                    >
                        <div
                            className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                        >
                            <div
                                className="flex items-center justify-between px-6 py-4"
                                style={{ borderBottom: '1px solid var(--border)' }}
                            >
                                <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {editSubcategory ? 'Edit Subcategory' : 'Add Subcategory'}
                                </h2>
                                <button
                                    onClick={() => { setShowModal(false); }}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Parent Category Select */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Parent Category *
                                    </label>
                                    <select
                                        value={form.parentId}
                                        onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 rounded-xl border transition-colors"
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <option value="">Select parent category</option>
                                        {parentCategories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subcategory Name */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Subcategory Name *
                                    </label>
                                    <Input
                                        placeholder="e.g., Toned Milk, Fresh Bread"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Subcategory Icon
                                    </label>
                                    
                                    {/* Icon Type Tabs */}
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, iconType: 'url' })}
                                            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                                            style={{
                                                background: form.iconType === 'url' ? 'var(--accent)' : 'var(--bg-tertiary)',
                                                color: form.iconType === 'url' ? 'white' : 'var(--text-secondary)',
                                                border: form.iconType === 'url' ? '2px solid var(--accent)' : '2px solid var(--border)'
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            Image URL
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, iconType: 'upload' })}
                                            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                                            style={{
                                                background: form.iconType === 'upload' ? 'var(--accent)' : 'var(--bg-tertiary)',
                                                color: form.iconType === 'upload' ? 'white' : 'var(--text-secondary)',
                                                border: form.iconType === 'upload' ? '2px solid var(--accent)' : '2px solid var(--border)'
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload Image
                                        </button>
                                    </div>

                                    {/* URL Input */}
                                    {form.iconType === 'url' && (
                                        <div className="space-y-3">
                                            <Input
                                                placeholder="https://example.com/icon.png"
                                                value={form.iconUrl}
                                                onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                                                className="h-11"
                                            />
                                            {form.iconUrl && (
                                                <div 
                                                    className="p-4 rounded-xl flex items-center gap-4 border" 
                                                    style={{ 
                                                        background: 'var(--bg-tertiary)',
                                                        borderColor: 'var(--border)'
                                                    }}
                                                >
                                                    <div
                                                        className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                                                        style={{ 
                                                            background: form.color + '15',
                                                            border: `2px solid ${form.color}30`
                                                        }}
                                                    >
                                                        <img 
                                                            src={form.iconUrl} 
                                                            alt="Icon preview" 
                                                            className="w-10 h-10 object-contain" 
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Preview</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Icon will appear as shown</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Upload Image */}
                                    {form.iconType === 'upload' && (
                                        <div className="space-y-3">
                                            {imagePreview && (
                                                <div className="relative">
                                                    <div 
                                                        className="p-4 rounded-xl flex items-center gap-4 border" 
                                                        style={{ 
                                                            background: 'var(--bg-tertiary)',
                                                            borderColor: 'var(--border)'
                                                        }}
                                                    >
                                                        <div
                                                            className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                                                            style={{ 
                                                                background: form.color + '15',
                                                                border: `2px solid ${form.color}30`
                                                            }}
                                                        >
                                                            <img 
                                                                src={imagePreview} 
                                                                alt="Icon preview" 
                                                                className="w-10 h-10 object-contain" 
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Image uploaded</p>
                                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Icon will appear as shown</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={clearImage}
                                                            className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                                                            style={{ color: 'var(--danger)' }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                                id="subcategory-image-upload"
                                            />
                                            <label
                                                htmlFor="subcategory-image-upload"
                                                className="flex flex-col items-center justify-center gap-3 py-12 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-[var(--accent)]"
                                                style={{ 
                                                    borderColor: 'var(--border)',
                                                    background: 'var(--bg-tertiary)'
                                                }}
                                            >
                                                <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <div className="text-center">
                                                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Click to upload image</p>
                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PNG, JPG, GIF (auto-compressed to 200x200)</p>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Theme Color
                                    </label>
                                    <div className="flex gap-2">
                                        {['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#E6A23C'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setForm({ ...form, color })}
                                                className="w-8 h-8 rounded-full transition-all hover:scale-110"
                                                style={{
                                                    backgroundColor: color,
                                                    boxShadow: form.color === color ? `0 0 0 3px var(--bg-secondary), 0 0 0 5px ${color}` : 'none'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                                    <Button type="button" variant="outline" onClick={() => { setShowModal(false); }}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        {editSubcategory ? 'Save Changes' : 'Add Subcategory'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
