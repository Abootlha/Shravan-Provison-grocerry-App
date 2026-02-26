import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { Plus, Pencil, Trash2, X, Search as SearchIcon, RefreshCw, ToggleLeft, ToggleRight, Sparkles, ChevronDown, Boxes, ImageIcon } from 'lucide-react';
import { Icon } from '@iconify/react';

interface Category {
    _id: string;
    name: string;
    icon: string;
    color: string;
    type: 'category' | 'subcategory';
    parentId?: string;
    isActive: boolean;
}

interface ItemGroup {
    _id: string;
    name: string;
    subcategoryId: { _id: string; name: string; parentId?: string } | string;
    image: string;
    description: string;
    isActive: boolean;
}

export default function ItemGroupsManager() {
    const [subcategories, setSubcategories] = useState<Category[]>([]);
    const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
    const [parentCategories, setParentCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editItemGroup, setEditItemGroup] = useState<ItemGroup | null>(null);
    const [search, setSearch] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');

    const [form, setForm] = useState({
        name: '',
        subcategoryId: '',
        image: '',
        description: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            // Fetch categories
            const catRes = await api.getCategories();
            const allCategories = catRes.categories || [];

            const mainCats = allCategories.filter((c: Category) => c.type !== 'subcategory');
            setParentCategories(mainCats);

            // Fetch subcategories from separate collection
            const subRes = await api.getAllSubcategories();
            const subCats = Array.isArray(subRes.subcategories) ? subRes.subcategories : [];
            setSubcategories(subCats);

            // Fetch item groups
            const igRes = await api.getItemGroups();
            const itemGroupsData = Array.isArray(igRes.itemGroups) ? igRes.itemGroups : [];
            setItemGroups(itemGroupsData);
        } catch (error) {
            console.error('Error fetching data:', error);
            // Set empty arrays on error to prevent undefined issues
            setSubcategories([]);
            setItemGroups([]);
            setParentCategories([]);
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
        setEditItemGroup(null);
        setForm({
            name: '',
            subcategoryId: selectedSubcategory || (subcategories[0]?._id || ''),
            image: '',
            description: '',
        });
        setShowModal(true);
    }

    function openEditModal(itemGroup: ItemGroup) {
        setEditItemGroup(itemGroup);
        const subcatId = typeof itemGroup.subcategoryId === 'object'
            ? itemGroup.subcategoryId._id
            : itemGroup.subcategoryId;
        setForm({
            name: itemGroup.name,
            subcategoryId: subcatId,
            image: itemGroup.image || '',
            description: itemGroup.description || '',
        });
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const data = {
                ...form,
                isActive: true,
            };

            if (editItemGroup?._id) {
                await api.updateItemGroup(editItemGroup._id, data);
            } else {
                await api.createItemGroup(data);
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            alert('Error saving item group');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this item group?')) return;
        try {
            await api.deleteItemGroup(id);
            fetchData();
        } catch (error) {
            alert('Error deleting item group');
        }
    }

    async function toggleActive(id: string, currentStatus: boolean) {
        try {
            await api.updateItemGroup(id, { isActive: !currentStatus });
            fetchData();
        } catch (error) {
            alert('Error updating item group');
        }
    }

    const getSubcategoryName = (subcategoryId: ItemGroup['subcategoryId']) => {
        if (!subcategoryId) return 'No Subcategory';
        if (typeof subcategoryId === 'object') return subcategoryId.name;
        const subcat = subcategories.find(c => c._id === subcategoryId);
        return subcat?.name || 'Unknown';
    };

    const getSubcategoryColor = (subcategoryId: ItemGroup['subcategoryId']) => {
        if (!subcategoryId) return '#666';
        const id = typeof subcategoryId === 'object' ? subcategoryId._id : subcategoryId;
        const subcat = subcategories.find(c => c._id === id);
        return subcat?.color || '#666';
    };

    const filteredItemGroups = itemGroups.filter(ig => {
        const matchesSearch = ig.name.toLowerCase().includes(search.toLowerCase());
        // Handle null subcategoryId safely
        const subcatId = ig.subcategoryId 
            ? (typeof ig.subcategoryId === 'object' ? ig.subcategoryId._id : ig.subcategoryId)
            : null;
        const matchesSubcategory = !selectedSubcategory || subcatId === selectedSubcategory;
        return matchesSearch && matchesSubcategory;
    });

    const stats = {
        total: itemGroups.length,
        active: itemGroups.filter(ig => ig.isActive).length,
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
                                    Step 3: Item Groups
                                </span>
                            </div>
                            <h1 className="font-display text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                Item Groups
                            </h1>
                            <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
                                Link item groups to subcategories
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button onClick={openAddModal}>
                                <Plus className="w-4 h-4 mr-2" /> Add Item Group
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up delay-2">
                    <div className="kpi-card">
                        <div className="flex items-center gap-4">
                            <div className="icon-container icon-purple">
                                <Boxes className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value">{stats.total}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Item Groups</p>
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
                            <div className="icon-container icon-blue">
                                <Boxes className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="metric-value" style={{ color: 'var(--info)' }}>{subcategories.length}</p>
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Subcategories</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 animate-slide-up delay-3">
                    <div className="relative flex-1 max-w-md">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <Input
                            placeholder="Search item groups..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-11"
                        />
                    </div>
                    <select
                        value={selectedSubcategory}
                        onChange={(e) => setSelectedSubcategory(e.target.value)}
                        className="px-4 py-2 rounded-xl border transition-colors"
                        style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <option value="">All Subcategories</option>
                        {Array.isArray(subcategories) && subcategories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                    </select>
                    {selectedSubcategory && (
                        <Button variant="ghost" onClick={() => setSelectedSubcategory('')}>
                            <X className="w-4 h-4 mr-2" />
                            Clear filter
                        </Button>
                    )}
                </div>

                {/* Item Groups Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredItemGroups.length === 0 ? (
                        <div className="col-span-full animate-slide-up delay-4">
                            <EmptyState
                                type="products"
                                title="No item groups found"
                                description={search ? "Try a different search term" : "Create your first item group"}
                                action={!search && (
                                    <Button onClick={openAddModal}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Item Group
                                    </Button>
                                )}
                            />
                        </div>
                    ) : (
                        filteredItemGroups.map((itemGroup, index) => (
                            <div
                                key={itemGroup._id}
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
                                        const color = getSubcategoryColor(itemGroup.subcategoryId);
                                        (e.currentTarget as HTMLElement).style.borderColor = color + '60';
                                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${color}20`;
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Image or Placeholder */}
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden transition-transform group-hover:scale-110"
                                            style={{
                                                backgroundColor: getSubcategoryColor(itemGroup.subcategoryId) + '18',
                                                border: `1px solid ${getSubcategoryColor(itemGroup.subcategoryId)}30`
                                            }}
                                        >
                                            {itemGroup.image ? (
                                                <img src={itemGroup.image} alt={itemGroup.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Boxes className="w-8 h-8" style={{ color: getSubcategoryColor(itemGroup.subcategoryId) }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-display font-semibold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
                                                {itemGroup.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge
                                                    variant="outline"
                                                    style={{
                                                        borderColor: getSubcategoryColor(itemGroup.subcategoryId) + '50',
                                                        color: getSubcategoryColor(itemGroup.subcategoryId)
                                                    }}
                                                >
                                                    {getSubcategoryName(itemGroup.subcategoryId)}
                                                </Badge>
                                                <Badge variant={itemGroup.isActive ? 'success' : 'secondary'}>
                                                    {itemGroup.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            {itemGroup.description && (
                                                <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {itemGroup.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                            <button
                                                onClick={() => openEditModal(itemGroup)}
                                                className="p-2 rounded-lg transition-colors"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleActive(itemGroup._id, itemGroup.isActive)}
                                                className="p-2 rounded-lg transition-colors"
                                            >
                                                {itemGroup.isActive ? (
                                                    <ToggleRight className="w-4 h-4" style={{ color: 'var(--success)' }} />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(itemGroup._id)}
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
                            className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                        >
                            <div
                                className="flex items-center justify-between px-6 py-4"
                                style={{ borderBottom: '1px solid var(--border)' }}
                            >
                                <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {editItemGroup ? 'Edit Item Group' : 'Add Item Group'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Subcategory Select */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Subcategory *
                                    </label>
                                    <select
                                        value={form.subcategoryId}
                                        onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 rounded-xl border transition-colors"
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <option value="">Select subcategory</option>
                                        {Array.isArray(subcategories) && subcategories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Item Group Name */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Item Group Name *
                                    </label>
                                    <Input
                                        placeholder="e.g., Toned Milk, Full Cream Milk"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Image URL */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Image URL (optional)
                                    </label>
                                    <div className="flex gap-3">
                                        <Input
                                            placeholder="https://example.com/image.jpg"
                                            value={form.image}
                                            onChange={(e) => setForm({ ...form, image: e.target.value })}
                                            className="flex-1"
                                        />
                                        {form.image && (
                                            <div className="w-12 h-12 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                                                <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                                        Description (optional)
                                    </label>
                                    <textarea
                                        placeholder="Brief description of this item group..."
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border transition-colors resize-none"
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            borderColor: 'var(--border)',
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                </div>

                                <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                                    <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        {editItemGroup ? 'Save Changes' : 'Add Item Group'}
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
