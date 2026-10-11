import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Layers, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
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
    TextareaField,
    confirm,
    withProviders,
} from '@/components/shared';
import { Badge } from '@/components/ui/badge';
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
    useSubcategories,
} from './api';
import { ActiveSwitch } from './ActiveSwitch';
import { CatalogNav } from './CatalogNav';
import { ImageField, InactiveBadge, SearchInput, ShowInactiveToggle, Thumb, pluralize } from './parts';
import { RowActions } from './RowActions';
import { imageSchema } from './schemas';
import { refId, refName, type Category, type ItemGroup, type Subcategory } from './types';
import { useCatalogSearch } from './useCatalogSearch';
import { SHEET_WIDTH } from './parts';
import { useClientTable } from './useClientTable';

const ALL = 'all';

const schema = z.object({
    name: z.string().trim().min(1, 'Enter a name').max(100, 'Keep it under 100 characters'),
    categoryId: z.string().min(1, 'Choose a category first'),
    subcategoryId: z.string().min(1, 'Choose the subcategory it belongs to'),
    image: imageSchema(),
    description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
    tags: z
        .string()
        .transform((v) =>
            v
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
        )
        .refine((tags) => tags.length <= 50, 'Use at most 50 tags')
        .refine((tags) => tags.every((t) => t.length <= 50), 'Keep each tag under 50 characters'),
    sortOrder: z.number({ invalid_type_error: 'Enter a whole number' }).int('Use a whole number').min(0, 'Use 0 or more'),
    isActive: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type Values = z.output<typeof schema>;

function readParam(name: string) {
    if (typeof window === 'undefined') return null;
    return new URL(window.location.href).searchParams.get(name);
}

function ItemGroupsPage() {
    useCatalogSearch();
    const canEdit = useCanEditCatalog();
    const query = useItemGroups();
    const categories = useCategories();
    const subcategories = useSubcategories();
    const [search, setSearch] = React.useState('');
    const [category, setCategory] = React.useState<string>(ALL);
    const [subcategory, setSubcategory] = React.useState<string>(ALL);
    const [showHidden, setShowHidden] = React.useState(false);
    const [editing, setEditing] = React.useState<ItemGroup | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const intent = React.useRef<{ action: string | null; id: string | null; subcategory: string | null } | null>(null);

    const all = query.data;
    const categoryById = React.useMemo(() => new Map((categories.data ?? []).map((c) => [c._id, c])), [categories.data]);
    const subById = React.useMemo(() => new Map((subcategories.data ?? []).map((s) => [s._id, s])), [subcategories.data]);
    const hiddenCount = all?.filter((g) => !g.isActive).length ?? 0;

    /** Category of an item group: its populated subcategory's parent, else the subcategory list. */
    const categoryOf = React.useCallback(
        (g: ItemGroup) => {
            const sub = g.subcategoryId;
            const parent = sub && typeof sub === 'object' ? sub.parentId : undefined;
            return parent ?? refId(subById.get(refId(sub) ?? '')?.parentId);
        },
        [subById],
    );

    const rows = React.useMemo(() => {
        if (!all) return undefined;
        const q = search.trim().toLowerCase();
        return all.filter(
            (g) =>
                (showHidden || g.isActive) &&
                (category === ALL || categoryOf(g) === category) &&
                (subcategory === ALL || refId(g.subcategoryId) === subcategory) &&
                (!q || g.name.toLowerCase().includes(q) || g.tags?.some((t) => t.toLowerCase().includes(q))),
        );
    }, [all, search, category, subcategory, showHidden, categoryOf]);

    const subOptions = React.useMemo(
        () =>
            (subcategories.data ?? [])
                .filter((s) => category === ALL || refId(s.parentId) === category)
                .map((s) => ({ value: s._id, label: s.isActive ? s.name : `${s.name} (hidden)` })),
        [subcategories.data, category],
    );

    const openCreate = React.useCallback(() => {
        setEditing(null);
        setFormOpen(true);
    }, []);
    const openEdit = React.useCallback((g: ItemGroup) => {
        setEditing(g);
        setFormOpen(true);
    }, []);

    React.useEffect(() => {
        const sub = readParam('subcategory');
        intent.current = { ...takeUrlIntent(), subcategory: sub };
        // With ?subcategory= the form opens once the filters are set, so it starts pre-filled.
        if (intent.current.action === 'new' && !sub) {
            intent.current.action = null;
            openCreate();
        }
    }, [openCreate]);
    // ?subcategory= (from the Subcategories page) selects both levels once the lists are in.
    React.useEffect(() => {
        const sub = intent.current?.subcategory;
        if (!sub || !subcategories.data) return;
        intent.current!.subcategory = null;
        const found = subById.get(sub);
        if (found) {
            setCategory(refId(found.parentId) ?? ALL);
            setSubcategory(sub);
        }
        if (intent.current!.action === 'new') {
            intent.current!.action = null;
            openCreate();
        }
    }, [subcategories.data, subById, openCreate]);
    React.useEffect(() => {
        const id = intent.current?.id;
        if (!id || !all) return;
        intent.current!.id = null;
        const found = all.find((g) => g._id === id);
        if (found) {
            if (!found.isActive) setShowHidden(true);
            openEdit(found);
        } else toast.error('That item group no longer exists');
    }, [all, openEdit]);

    const setActive = React.useCallback(async (g: ItemGroup, isActive: boolean, undoable = true) => {
        const undo = patchCachedRecord<ItemGroup>(catalogKeys.itemGroups, g._id, { isActive });
        try {
            await http.put(`/item-groups/${g._id}`, { isActive });
            toast.success(isActive ? `${g.name} is visible in the app` : `${g.name} is hidden from the app`, {
                action: undoable ? { label: 'Undo', onClick: () => void setActive({ ...g, isActive }, !isActive, false) } : undefined,
            });
        } catch (error) {
            undo();
            toast.error(`Could not ${isActive ? 'show' : 'hide'} ${g.name}`, { description: errorMessage(error) });
        } finally {
            void invalidateCatalog();
        }
    }, []);

    const remove = React.useCallback(async (g: ItemGroup) => {
        let products: number | undefined;
        try {
            products = await productCountQuery('itemGroupId', g._id);
        } catch {
            products = undefined;
        }
        const impact =
            products === undefined
                ? 'Could not check how many products use it.'
                : products > 0
                  ? `${pluralize(products, 'product')} filed here will lose their item group.`
                  : 'No products are filed under it.';
        await confirm({
            title: `Delete “${g.name}”?`,
            description: (
                <>
                    {impact} This cannot be undone.{(products ?? 0) > 0 ? ' Hiding it instead keeps everything and can be reversed.' : null}
                </>
            ),
            confirmLabel: 'Delete item group',
            tone: 'destructive',
            onConfirm: async () => {
                await http.del(`/item-groups/${g._id}`);
                toast.success(`${g.name} deleted`);
                await invalidateCatalog();
            },
        });
    }, []);

    const subName = React.useCallback((g: ItemGroup) => refName(g.subcategoryId) ?? subById.get(refId(g.subcategoryId) ?? '')?.name, [subById]);

    const columns = React.useMemo<ColumnDef<ItemGroup>[]>(
        () => [
            {
                id: 'name',
                accessorFn: (g) => g.name,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Item group" />,
                cell: ({ row }) => {
                    const g = row.original;
                    return (
                        <div className="flex min-w-52 items-center gap-3">
                            <Thumb src={g.image} name={g.name} size="sm" className={g.isActive ? undefined : 'opacity-50'} />
                            <button
                                type="button"
                                disabled={!canEdit}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(g);
                                }}
                                className="flex min-w-0 items-center gap-2 rounded-md text-left font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                                aria-label={`Edit ${g.name}`}
                            >
                                <span className={g.isActive ? 'truncate text-foreground' : 'truncate text-muted-foreground'}>{g.name}</span>
                                {g.isActive ? null : <InactiveBadge />}
                            </button>
                        </div>
                    );
                },
                meta: { label: 'Item group' },
            },
            {
                id: 'subcategory',
                accessorFn: (g) => subName(g) ?? '',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Subcategory" />,
                cell: ({ row }) => {
                    const name = subName(row.original);
                    return name ? <span className="whitespace-nowrap">{name}</span> : <span className="text-destructive">Missing subcategory</span>;
                },
                meta: { label: 'Subcategory' },
            },
            {
                id: 'category',
                accessorFn: (g) => categoryById.get(categoryOf(g) ?? '')?.name ?? '',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
                cell: ({ row }) => {
                    const c = categoryById.get(categoryOf(row.original) ?? '');
                    return <span className="whitespace-nowrap text-muted-foreground">{c?.name ?? '—'}</span>;
                },
                meta: { label: 'Category' },
            },
            {
                id: 'tags',
                header: 'Tags',
                enableSorting: false,
                cell: ({ row }) => {
                    const tags = row.original.tags ?? [];
                    if (!tags.length) return <span className="text-muted-foreground">—</span>;
                    return (
                        <span className="flex max-w-64 flex-wrap gap-1">
                            {tags.slice(0, 3).map((t) => (
                                <Badge key={t} variant="neutral">
                                    {t}
                                </Badge>
                            ))}
                            {tags.length > 3 ? <span className="text-xs text-muted-foreground">+{tags.length - 3}</span> : null}
                        </span>
                    );
                },
                meta: { label: 'Tags' },
            },
            {
                accessorKey: 'sortOrder',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
                cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{getValue<number>()}</span>,
                meta: { align: 'right', label: 'Order' },
            },
            {
                id: 'isActive',
                header: 'In app',
                enableSorting: false,
                cell: ({ row }) => (
                    <ActiveSwitch
                        name={row.original.name}
                        checked={row.original.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(next) => void setActive(row.original, next)}
                    />
                ),
                meta: { align: 'center', label: 'In app' },
            },
            {
                id: 'actions',
                header: () => <span className="sr-only">Actions</span>,
                enableHiding: false,
                enableSorting: false,
                cell: ({ row }) => {
                    const g = row.original;
                    return (
                        <RowActions
                            label={g.name}
                            actions={
                                canEdit
                                    ? [
                                          { label: 'Edit', icon: Pencil, onSelect: () => openEdit(g) },
                                          g.isActive
                                              ? { label: 'Hide from app', icon: EyeOff, onSelect: () => void setActive(g, false), separated: true }
                                              : { label: 'Show in app', icon: Eye, onSelect: () => void setActive(g, true), separated: true },
                                          { label: 'Delete…', icon: Trash2, destructive: true, onSelect: () => void remove(g) },
                                      ]
                                    : []
                            }
                        />
                    );
                },
                meta: { className: 'w-10' },
            },
        ],
        [canEdit, categoryById, categoryOf, openEdit, remove, setActive, subName],
    );

    const sortValue = React.useCallback(
        (g: ItemGroup, id: string): string | number => {
            switch (id) {
                case 'subcategory':
                    return subName(g) ?? '';
                case 'category':
                    return categoryById.get(categoryOf(g) ?? '')?.name ?? '';
                case 'sortOrder':
                    return g.sortOrder ?? 0;
                default:
                    return g.name;
            }
        },
        [subName, categoryById, categoryOf],
    );
    const table = useClientTable({ rows, sortValue, resetKey: `${category}|${subcategory}|${showHidden}|${search}` });

    const filtered = search.trim() !== '' || category !== ALL || subcategory !== ALL;
    const clearFilters = () => {
        setSearch('');
        setCategory(ALL);
        setSubcategory(ALL);
    };

    const onSubmit = async (values: Values) => {
        const { categoryId: _category, ...body } = values;
        if (editing) {
            await http.put(`/item-groups/${editing._id}`, body);
            toast.success(`${values.name} saved`);
        } else {
            await http.post('/item-groups', body);
            toast.success(`${values.name} created`);
        }
        await invalidateCatalog();
    };

    const editingSub = editing ? refId(editing.subcategoryId) : subcategory !== ALL ? subcategory : '';
    const editingCategory = editing ? (categoryOf(editing) ?? '') : category !== ALL ? category : editingSub ? (refId(subById.get(editingSub)?.parentId) ?? '') : '';

    return (
        <PageContainer>
            <PageHeader
                title="Item groups"
                description="The third level: brands or product lines inside a subcategory, such as “Amul” under Butter."
                actions={
                    canEdit ? (
                        <Button onClick={openCreate}>
                            <Plus aria-hidden />
                            New item group
                        </Button>
                    ) : null
                }
            >
                <CatalogNav current="item-groups" />
            </PageHeader>

            <DataTable
                label="Item groups"
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
                        <SearchInput value={search} onChange={setSearch} placeholder="Search name or tag" label="Search item groups" />
                        <Select
                            value={category}
                            onValueChange={(next) => {
                                setCategory(next);
                                setSubcategory(ALL);
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All categories</SelectItem>
                                {(categories.data ?? []).map((c) => (
                                    <SelectItem key={c._id} value={c._id}>
                                        {c.isActive ? c.name : `${c.name} (hidden)`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={subcategory} onValueChange={setSubcategory} disabled={!subOptions.length}>
                            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by subcategory">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{category === ALL ? 'All subcategories' : 'All in this category'}</SelectItem>
                                {subOptions.map((o) => (
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
                            title="No item groups match"
                            description={hiddenCount && !showHidden ? 'Hidden item groups are not shown. Turn on “Show hidden” to include them.' : 'Try another name, or a different category.'}
                            action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
                        />
                    ) : (
                        <EmptyState
                            icon={Layers}
                            title={all?.length ? 'Every item group is hidden' : 'No item groups yet'}
                            description={all?.length ? 'Turn on “Show hidden” to see them.' : 'Item groups let customers narrow a subcategory down by brand or type.'}
                            action={canEdit && !all?.length ? <Button onClick={openCreate}><Plus aria-hidden />New item group</Button> : undefined}
                        />
                    )
                }
            />

            <FormSheet
                open={formOpen}
                onOpenChange={setFormOpen}
                className={SHEET_WIDTH}
                title={editing ? `Edit ${editing.name}` : 'New item group'}
                schema={schema}
                defaultValues={{
                    name: editing?.name ?? '',
                    categoryId: editingCategory,
                    subcategoryId: editingSub ?? '',
                    image: editing?.image ?? '',
                    description: editing?.description ?? '',
                    tags: (editing?.tags ?? []).join(', '),
                    sortOrder: editing?.sortOrder ?? 0,
                    isActive: editing?.isActive ?? true,
                }}
                submitLabel={editing ? 'Save changes' : 'Create item group'}
                onSubmit={onSubmit}
            >
                {(form) => (
                    <>
                        <TextField form={form} name="name" label="Name" autoComplete="off" placeholder="Amul" />
                        <CascadeFields form={form} categories={categories.data ?? []} subcategories={subcategories.data ?? []} />
                        <ImageField form={form} name="image" label="Image" previewName={form.watch('name')} description="Optional. A brand logo or pack shot." />
                        <TextField
                            form={form}
                            name="tags"
                            label="Search tags"
                            autoComplete="off"
                            placeholder="butter, salted, makhan"
                            description="Comma separated. Customers searching these words find this group."
                        />
                        <TextareaField form={form} name="description" label="Description" rows={3} />
                        <TextField
                            form={form}
                            name="sortOrder"
                            label="Position in its subcategory"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            className="sm:max-w-48"
                            description="Lower numbers come first."
                        />
                        <SwitchField form={form} name="isActive" label="Show in the app" description="Hidden item groups keep their products and can be turned back on." />
                    </>
                )}
            </FormSheet>
        </PageContainer>
    );
}

/** Category → subcategory pair: picking a category narrows the subcategory list and clears a mismatch. */
function CascadeFields({
    form,
    categories,
    subcategories,
}: {
    form: UseFormReturn<FormInput, unknown, Values>;
    categories: Category[];
    subcategories: Subcategory[];
}) {
    const categoryId = form.watch('categoryId');
    const subcategoryId = form.watch('subcategoryId');
    const options = subcategories
        .filter((s) => refId(s.parentId) === categoryId)
        .map((s) => ({ value: s._id, label: s.isActive ? s.name : `${s.name} (hidden)` }));

    React.useEffect(() => {
        if (subcategoryId && categoryId && !subcategories.some((s) => s._id === subcategoryId && refId(s.parentId) === categoryId)) {
            form.setValue('subcategoryId', '', { shouldValidate: false });
        }
    }, [categoryId, subcategoryId, subcategories, form]);

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
                form={form}
                name="categoryId"
                label="Category"
                placeholder="Choose a category"
                options={categories.map((c) => ({ value: c._id, label: c.isActive ? c.name : `${c.name} (hidden)` }))}
            />
            <SelectField
                form={form}
                name="subcategoryId"
                label="Subcategory"
                placeholder={categoryId ? (options.length ? 'Choose a subcategory' : 'No subcategories here yet') : 'Pick a category first'}
                disabled={!categoryId || !options.length}
                options={options}
            />
        </div>
    );
}

export default withProviders(ItemGroupsPage);
