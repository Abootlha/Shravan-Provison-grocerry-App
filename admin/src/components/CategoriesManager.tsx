import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Plus, Pencil, Trash2, Tags, X, Search as SearchIcon, Grid3X3, RefreshCw, ToggleLeft, ToggleRight, Sparkles, Package } from 'lucide-react';

interface Category {
    _id: string;
    name: string;
    icon: string;
    color: string;
    type: 'beverage' | 'non-beverage';
    isActive: boolean;
    productCount?: number;
}

// Grocery icon library


export default function CategoriesManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [search, setSearch] = useState('');
    const [imagePreview, setImagePreview] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: '',
        icon: '',
        color: '#E6A23C',
        iconType: 'url' as 'url' | 'upload',
        iconUrl: ''
    });

    useEffect(() => {
        fetchCategories();
    }, []);

    async function fetchCategories() {
        try {
            const data = await api.getCategories();
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleRefresh = () => {
        setRefreshing(true);
        fetchCategories();
    };

    function openAddModal() {
        setEditCategory(null);
        setForm({ name: '', icon: '', color: '#E6A23C', iconType: 'url', iconUrl: '' });
        setImagePreview('');
        setShowModal(true);
    }

    function openEditModal(category: Category) {
        setEditCategory(category);
        const isUrl = category.icon?.startsWith('http');
        const isBase64 = category.icon?.startsWith('data:image/');
        setForm({
            name: category.name,
            icon: isBase64 ? category.icon : '',
            color: category.color || '#E6A23C',
            iconType: isBase64 ? 'upload' : 'url',
            iconUrl: isUrl ? category.icon : ''
        });
        setImagePreview((isUrl || isBase64) ? category.icon : '');
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
                isActive: true
            };
            
            if (editCategory?._id) {
                await api.updateCategory(editCategory._id, data);
            } else {
                await api.createCategory(data);
            }
            setShowModal(false);
            fetchCategories();
        } catch (error) {
            alert('Error saving category');
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setImagePreview(base64);
                setForm({ ...form, icon: base64 });
            };
            reader.readAsDataURL(file);
        }
    }

    function clearImage() {
        setImagePreview('');
        setForm({ ...form, icon: '', iconUrl: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            await api.deleteCategory(id);
            fetchCategories();
        } catch (error) {
            alert('Error deleting category');
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            await api.updateCategory(id, { isActive: !currentStatus });
            fetchCategories();
        } catch (error) {
            alert('Error updating category');
        }
    }

    

    const filteredCategories = categories.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    const stats = {
        total: categories.length,
        active: categories.filter(c => c.isActive).length,
    };

    if (loading) {
        return (
            <div className="dashboard-bg min-h-screen">
                <div className="relative z-10 p-6 lg:p-8 space-y-8">
                    <div className="flex justify-between">
                        <Skeleton className="h-12 w-64" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
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
                                    Product Organization
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Categories
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                Organize your products into categories
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button onClick={openAddModal}>
                                <Plus className="w-4 h-4 mr-2" /> Add Category
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up delay-2">
                    <div className="kpi-card group">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-amber group-hover:scale-110 transition-transform">
                                <Grid3X3 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value">{stats.total}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Categories</p>
                            </div>
                        </div>
                    </div>

                    <div className="kpi-card group">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-green group-hover:scale-110 transition-transform">
                                <Tags className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--success)' }}>{stats.active}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex gap-4 animate-slide-up delay-3">
                    <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11"
                        />
                    </div>
                </div>

                {/* Category Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCategories.length === 0 ? (
                        <div className="col-span-full animate-slide-up delay-4">
                            <EmptyState
                                type="categories"
                                title="No categories found"
                                description={search ? "Try a different search term" : "Create your first category to organize products"}
                                action={!search && (
                                    <Button onClick={openAddModal}>
                                        <Plus className="w-4 h-4 mr-2" /> Add First Category
                                    </Button>
                                )}
                            />
                        </div>
                    ) : (
                        filteredCategories.map((category, index) => (
                            <div
                                key={category._id}
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
                                        (e.currentTarget as HTMLElement).style.borderColor = category.color + '60';
                                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${category.color}20`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Glow accent line */}
                                    <div
                                        className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: category.color }}
                                    />

                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 overflow-hidden"
                                            style={{
                                                backgroundColor: category.color + '18',
                                                border: `1px solid ${category.color}30`
                                            }}
                                        >
                                            {(category.icon?.startsWith('http') || category.icon?.startsWith('data:image/')) ? (
                                                <img src={category.icon} alt={category.name} className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <Package className="w-9 h-9" style={{ color: category.color }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-display font-semibold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
                                                {category.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Badge variant={category.isActive ? 'success' : 'secondary'}>
                                                    {category.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={() => openEditModal(category)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--text-muted)' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleActive(category._id, category.isActive)}
                                                className="p-2 rounded-lg transition-colors"
                                            >
                                                {category.isActive ? (
                                                    <ToggleRight className="w-4 h-4" style={{ color: 'var(--success)' }} />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category._id)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--danger)' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
                                    {editCategory ? 'Edit Category' : 'Add Category'}
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
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Category Name
                                    </label>
                                    <Input
                                        placeholder="e.g., Fruits & Vegetables"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Icon Picker */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Category Icon
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
                                                id="category-image-upload"
                                            />
                                            <label
                                                htmlFor="category-image-upload"
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
                                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PNG, JPG, GIF up to 5MB</p>
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
                                    <div className="flex gap-3 items-center">
                                        <input
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                                            className="w-12 h-11 rounded-xl cursor-pointer border-0"
                                            style={{ background: 'var(--bg-tertiary)' }}
                                        />
                                        <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        {['#E6A23C', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setForm({ ...form, color })}
                                                className="w-9 h-9 rounded-full transition-all hover:scale-110"
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
                                        {editCategory ? 'Save Changes' : 'Add Category'}
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
