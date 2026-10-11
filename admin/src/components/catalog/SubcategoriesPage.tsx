import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Layers, Pencil, Plus, SearchX, Tags, Trash2 } from 'lucide-react';
import {
    DataTable,
    DataTableColumnHeader,
    EmptyState,
    FormSheet,
    PageContainer,
    PageHeader,
    SelectField,
    SwitchField,
    TextField,
    confirm,
    withProviders,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage, http } from '@/lib/http';
import {
    catalogKeys,
    invalidateCatalog,
    patchCachedRecord,
    productCountQuery,
    takeUrlIntent,
    useCanEditCatalog,
    useCategories,
    useItemGroups,
    useProductCounts,
    useSubcategories,
} from './api';
import { ActiveSwitch } from './ActiveSwitch';
import { CatalogNav } from './CatalogNav';
import { BilingualName, CountCell, ImageField, SearchInput, ShowInactiveToggle, Thumb, pluralize } from './parts';
import { RowActions } from './RowActions';
import { imageSchema } from './schemas';
import { refId, refName, type Category, type Subcategory } from './types';
import { useCatalogSearch } from './useCatalogSearch';
import { useClientTable } from './useClientTable';

const DEFAULT_TILE_COLOR = '#F2F2F0';
const ALL = 'all';

const schema = z.object({
    name: z.string().trim().min(1, 'Enter a name').max(100, 'Keep it under 100 characters'),
    nameHi: z.string().trim().max(100, 'Keep it under 100 characters'),
    parentId: z.string().min(1, 'Choose the category it belongs to'),
    icon: imageSchema({ allowPlainIcon: true, required: true }),
    sortOrder: z.number({ invalid_type_error: 'Enter a whole number' }).int('Use a whole number').min(0, 'Use 0 or more'),
    isActive: z.boolean(),
});
type Values = z.output<typeof schema>;

function readParam(name: string) {
    if (typeof window === 'undefined') return null;
    return new URL(window.location.href).searchParams.get(name);
}

function SubcategoriesPage() {
    useCatalogSearch();
    const canEdit = useCanEditCatalog();
    const query = useSubcategories();
    const categories = useCategories();
    const itemGroups = useItemGroups();
    const [search, setSearch] = React.useState('');
    const [parent, setParent] = React.useState<string>(ALL);
    const [showHidden, setShowHidden] = React.useState(false);
    const [editing, setEditing] = React.useState<Subcategory | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const intent = React.useRef<{ action: string | null; id: string | null } | null>(null);

    const all = query.data;
    const categoryById = React.useMemo(() => new Map((categories.data ?? []).map((c) => [c._id, c])), [categories.data]);
    const hiddenCount = all?.filter((s) => !s.isActive).length ?? 0;
    const counts = useProductCounts('subcategoryId', all?.map((s) => s._id) ?? []);
    const groupCounts = React.useMemo(() => {
        const map = new Map<string, number>();
        for (const g of itemGroups.data ?? []) {
            const id = refId(g.subcategoryId);
            if (id) map.set(id, (map.get(id) ?? 0) + 1);
        }
        return map;
    }, [itemGroups.data]);

    const rows = React.useMemo(() => {
        if (!all) return undefined;
        const q = search.trim().toLowerCase();
        return all.filter(
            (s) =>
                (showHidden || s.isActive) &&
                (parent === ALL || refId(s.parentId) === parent) &&
                (!q || s.name.toLowerCase().includes(q) || s.nameHi?.toLowerCase().includes(q)),
        );
    }, [all, search, parent, showHidden]);

    const openCreate = React.useCallback(() => {
        setEditing(null);
        setFormOpen(true);
    }, []);
    const openEdit = React.useCallback((s: Subcategory) => {
        setEditing(s);
        setFormOpen(true);
    }, []);

    React.useEffect(() => {
        const category = readParam('category');
        if (category) setParent(category);
        intent.current = takeUrlIntent();
        if (intent.current.action === 'new') {
            intent.current = null;
            openCreate();
        }
    }, [openCreate]);
    React.useEffect(() => {
        const id = intent.current?.id;
        if (!id || !all) return;
        intent.current = null;
        const found = all.find((s) => s._id === id);
        if (found) {
            if (!found.isActive) setShowHidden(true);
            openEdit(found);
        } else toast.error('That subcategory no longer exists');
    }, [all, openEdit]);

    const setActive = React.useCallback(async (s: Subcategory, isActive: boolean, undoable = true) => {
        const undo = patchCachedRecord<Subcategory>(catalogKeys.subcategories, s._id, { isActive });
        try {
            await http.put(`/subcategories/${s._id}`, { isActive });
            toast.success(isActive ? `${s.name} is visible in the app` : `${s.name} is hidden from the app`, {
                action: undoable ? { label: 'Undo', onClick: () => void setActive({ ...s, isActive }, !isActive, false) } : undefined,
            });
        } catch (error) {
            undo();
            toast.error(`Could not ${isActive ? 'show' : 'hide'} ${s.name}`, { description: errorMessage(error) });
        } finally {
            void invalidateCatalog();
        }
    }, []);

    const remove = React.useCallback(
        async (s: Subcategory) => {
            let products: number | undefined;
            try {
                products = await productCountQuery('subcategoryId', s._id);
            } catch {
                products = undefined;
            }
            const groups = groupCounts.get(s._id) ?? 0;
            const impact: string[] = [];
            if (products === undefined) impact.push('Could not check how many products use it.');
            else if (products > 0) impact.push(`${pluralize(products, 'product')} filed here will lose their subcategory.`);
            else impact.push('No products are filed under it.');
            if (groups > 0) impact.push(`Its ${pluralize(groups, 'item group')} will be left without a parent.`);
            await confirm({
                title: `Delete “${s.name}”?`,
                description: (
                    <>
                        {impact.join(' ')} This cannot be undone.{' '}
                        {(products ?? 0) > 0 || groups > 0 ? 'Hiding it instead keeps everything and can be reversed.' : null}
                    </>
                ),
                confirmLabel: 'Delete subcategory',
                tone: 'destructive',
                onConfirm: async () => {
                    await http.del(`/subcategories/${s._id}`);
                    toast.success(`${s.name} deleted`);
                    await invalidateCatalog();
                },
            });
        },
        [groupCounts],
    );

    const columns = React.useMemo<ColumnDef<Subcategory>[]>(
        () => [
            {
                id: 'name',
                accessorFn: (s) => s.name,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Subcategory" />,
                cell: ({ row }) => {
                    const s = row.original;
                    return (
                        <div className="flex min-w-56 items-center gap-3">
                            <Thumb src={s.image || s.icon} name={s.name} className={s.isActive ? undefined : 'opacity-50'} />
                            <button
                                type="button"
                                disabled={!canEdit}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(s);
                                }}
                                className="min-w-0 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                                aria-label={`Edit ${s.name}`}
                            >
                                <BilingualName name={s.name} nameHi={s.nameHi} inactive={!s.isActive} />
                            </button>
                        </div>
                    );
                },
                meta: { label: 'Subcategory' },
            },
            {
                id: 'parent',
                accessorFn: (s) => refName(s.parentId) ?? categoryById.get(refId(s.parentId) ?? '')?.name ?? '',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
                cell: ({ row }) => <ParentCell parentId={row.original.parentId} categoryById={categoryById} />,
                meta: { label: 'Category', className: 'min-w-40' },
            },
            {
                id: 'itemGroups',
                accessorFn: (s) => groupCounts.get(s._id) ?? 0,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Item groups" />,
                cell: ({ row }) =>
                    itemGroups.data ? (
                        <a
                            href={`/item-groups?subcategory=${row.original._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="tabular-nums underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                            aria-label={`${groupCounts.get(row.original._id) ?? 0} item groups in ${row.original.name}. Open them`}
                        >
                            {groupCounts.get(row.original._id) ?? 0}
                        </a>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    ),
                meta: { align: 'right', label: 'Item groups' },
            },
            {
                id: 'products',
                accessorFn: (s) => counts[s._id] ?? -1,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Products" />,
                cell: ({ row }) => <CountCell value={counts[row.original._id]} />,
                meta: { align: 'right', label: 'Products' },
            },
            {
                accessorKey: 'sortOrder',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
                cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<number>()}</span>,
                meta: { align: 'right', label: 'Order' },
            },
            {
                id: 'isActive',
                accessorKey: 'isActive',
                header: 'In app',
                cell: ({ row }) => (
                    <ActiveSwitch
                        name={row.original.name}
                        checked={row.original.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(next) => void setActive(row.original, next)}
                    />
                ),
                enableSorting: false,
                meta: { align: 'center', label: 'In app' },
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">Actions</span>,
                enableHiding: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const s = row.original;
                    return (
                        <RowActions
                            label={s.name}
                            actions={[
                                ...(canEdit ? [{ label: 'Edit', icon: Pencil, onSelect: () => openEdit(s) }] : []),
                                { label: 'View item groups', icon: Layers, onSelect: () => window.location.assign(`/item-groups?subcategory=${s._id}`) },
                                ...(canEdit
                                    ? [
                                          s.isActive
                                              ? { label: 'Hide from app', icon: EyeOff, onSelect: () => void setActive(s, false), separated: true }
                                              : { label: 'Show in app', icon: Eye, onSelect: () => void setActive(s, true), separated: true },
                                          { label: 'Delete…', icon: Trash2, destructive: true, onSelect: () => void remove(s) },
                                      ]
                                    : []),
                            ]}
                        />
                    );
                },
                meta: { className: 'w-10' },
            },
        ],
        [canEdit, categoryById, counts, groupCounts, itemGroups.data, openEdit, remove, setActive],
    );

    const sortValue = React.useCallback(
        (s: Subcategory, id: string): string | number => {
            switch (id) {
                case 'parent':
                    return refName(s.parentId) ?? categoryById.get(refId(s.parentId) ?? '')?.name ?? '';
                case 'itemGroups':
                    return groupCounts.get(s._id) ?? 0;
                case 'products':
                    return counts[s._id] ?? -1;
                case 'sortOrder':
                    return s.sortOrder ?? 0;
                default:
                    return s.name;
            }
        },
        [categoryById, groupCounts, counts],
    );
    const table = useClientTable({ rows, sortValue, resetKey: `${parent}|${showHidden}|${search}` });

    const filtered = search.trim() !== '' || parent !== ALL;
    const parentOptions = (categories.data ?? []).map((c) => ({
        value: c._id,
        label: c.isActive ? c.name : `${c.name} (hidden)`,
    }));

    const onSubmit = async (values: Values) => {
        const body = { ...values };
        if (editing) {
            await http.put(`/subcategories/${editing._id}`, body);
            toast.success(`${values.name} saved`);
        } else {
            await http.post('/subcategories', { ...body, color: DEFAULT_TILE_COLOR });
            toast.success(`${values.name} created`);
        }
        await invalidateCatalog();
    };

    const nextOrderFor = (parentId: string) =>
        (all ?? []).filter((s) => refId(s.parentId) === parentId).reduce((max, s) => Math.max(max, s.sortOrder ?? 0), -1) + 1;

    return (
        <PageContainer>
            <PageHeader
                title="Subcategories"
                description="The second level: each one sits inside a category and holds item groups and products."
                actions={
                    canEdit ? (
                        <Button onClick={openCreate}>
                            <Plus aria-hidden />
                            New subcategory
                        </Button>
                    ) : null
                }
            >
                <CatalogNav current="subcategories" />
            </PageHeader>

            <DataTable
                label="Subcategories"
                columns={columns}
                {...table}
                loading={query.isPending}
                fetching={query.isFetching && !query.isPending}
                error={query.error ?? undefined}
                onRetry={() => query.refetch()}
                pageSizeOptions={[20, 50, 100]}
                onRowClick={canEdit ? openEdit : undefined}
                maxHeight="none"
                toolbar={
                    <>
                        <SearchInput value={search} onChange={setSearch} placeholder="Search subcategories" label="Search subcategories" />
                        <Select value={parent} onValueChange={setParent}>
                            <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All categories</SelectItem>
                                {parentOptions.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <ShowInactiveToggle checked={showHidden} onCheckedChange={setShowHidden} count={hiddenCount} />
                    </>
                }
                empty={
                    filtered ? (
                        <EmptyState
                            icon={SearchX}
                            title="No subcategories match"
                            description={hiddenCount && !showHidden ? 'Some subcategories are hidden. Turn on “Show hidden” to include them.' : 'Try another name or category.'}
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        setParent(ALL);
                                    }}
                                >
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Tags}
                            title={all?.length ? 'Every subcategory is hidden' : 'No subcategories yet'}
                            description={all?.length ? 'Turn on “Show hidden” to see them.' : 'Add one inside a category so products can be filed more precisely.'}
                            action={canEdit && !all?.length ? <Button onClick={openCreate}><Plus aria-hidden />New subcategory</Button> : undefined}
                        />
                    )
                }
            />

            <FormSheet
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? `Edit ${editing.name}` : 'New subcategory'}
                schema={schema}
                defaultValues={{
                    name: editing?.name ?? '',
                    nameHi: editing?.nameHi ?? '',
                    parentId: editing ? (refId(editing.parentId) ?? '') : parent !== ALL ? parent : '',
                    icon: editing?.icon ?? '',
                    sortOrder: editing?.sortOrder ?? (parent !== ALL ? nextOrderFor(parent) : 0),
                    isActive: editing?.isActive ?? true,
                }}
                submitLabel={editing ? 'Save changes' : 'Create subcategory'}
                onSubmit={onSubmit}
            >
                {(form) => (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField form={form} name="name" label="Name (English)" autoComplete="off" placeholder="Cream Biscuits" />
                            <TextField form={form} name="nameHi" label="Name (Hindi)" lang="hi" autoComplete="off" placeholder="क्रीम बिस्कुट" />
                        </div>
                        <SelectField form={form} name="parentId" label="Category" options={parentOptions} placeholder="Choose a category" />
                        <ImageField
                            form={form}
                            name="icon"
                            label="Image"
                            previewName={form.watch('name')}
                            description="Shown on the subcategory tile. Paste a link or upload one under 1 MB."
                        />
                        <TextField
                            form={form}
                            name="sortOrder"
                            label="Position in its category"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            className="sm:max-w-48"
                            description="Lower numbers come first."
                        />
                        <SwitchField form={form} name="isActive" label="Show in the app" description="Hidden subcategories keep their products and can be turned back on." />
                    </>
                )}
            </FormSheet>
        </PageContainer>
    );
}

function ParentCell({ parentId, categoryById }: { parentId: Subcategory['parentId']; categoryById: Map<string, Category> }) {
    const id = refId(parentId);
    const category = id ? categoryById.get(id) : undefined;
    const name = refName(parentId) ?? category?.name;
    if (!name) return <span className="text-sm text-destructive">Missing category</span>;
    return (
        <span className="flex min-w-0 items-center gap-2">
            <Thumb src={category?.image || category?.icon || (typeof parentId === 'object' ? parentId?.icon : undefined)} name={name} size="sm" />
            <span className="truncate">{name}</span>
            {category && !category.isActive ? <span className="text-xs text-muted-foreground">(hidden)</span> : null}
        </span>
    );
}

export default withProviders(SubcategoriesPage);
