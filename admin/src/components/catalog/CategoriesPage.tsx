import * as React from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderTree, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import {
    EmptyState,
    ErrorState,
    FormSheet,
    PageContainer,
    PageHeader,
    SwitchField,
    TextField,
    confirm,
    withProviders,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, http } from '@/lib/http';
import { queryClient } from '@/lib/query';
import { cn } from '@/lib/utils';
import {
    catalogKeys,
    invalidateCatalog,
    mergeVisibleOrder,
    patchCachedRecord,
    productCountQuery,
    takeUrlIntent,
    useCanEditCatalog,
    useCategories,
    useProductCounts,
    useSubcategories,
} from './api';
import { CatalogNav } from './CatalogNav';
import { BilingualName, CountCell, ImageField, ShowInactiveToggle, Thumb, pluralize } from './parts';
import { RowActions } from './RowActions';
import { ActiveSwitch } from './ActiveSwitch';
import { SortableList } from './SortableList';
import { refId, type Category } from './types';
import { useCatalogSearch } from './useCatalogSearch';
import { imageSchema } from './schemas';

/** New categories get a neutral tile colour; the app no longer tints tiles per category. */
const DEFAULT_TILE_COLOR = '#F2F2F0';

const schema = z.object({
    name: z.string().trim().min(1, 'Enter a name').max(100, 'Keep it under 100 characters'),
    nameHi: z.string().trim().max(100, 'Keep it under 100 characters'),
    group: z.string().trim().max(50, 'Keep it under 50 characters'),
    groupHi: z.string().trim().max(50, 'Keep it under 50 characters'),
    icon: imageSchema({ allowPlainIcon: true }),
    isActive: z.boolean(),
});
type Values = z.output<typeof schema>;

function CategoriesPage() {
    useCatalogSearch();
    const canEdit = useCanEditCatalog();
    const query = useCategories();
    const subcategories = useSubcategories();
    const [showHidden, setShowHidden] = React.useState(false);
    const [editing, setEditing] = React.useState<Category | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const intent = React.useRef<{ action: string | null; id: string | null } | null>(null);

    const all = query.data;
    const hiddenCount = all?.filter((c) => !c.isActive).length ?? 0;
    const visible = React.useMemo(() => (all ? all.filter((c) => showHidden || c.isActive) : undefined), [all, showHidden]);
    const counts = useProductCounts('categoryId', all?.map((c) => c._id) ?? []);
    const groups = React.useMemo(
        () => [...new Set((all ?? []).map((c) => c.group?.trim()).filter((g): g is string => !!g))].sort(),
        [all],
    );

    const openCreate = React.useCallback(() => {
        setEditing(null);
        setFormOpen(true);
    }, []);
    const openEdit = React.useCallback((category: Category) => {
        setEditing(category);
        setFormOpen(true);
    }, []);

    // ⌘K "New category" lands on ?action=new; a search result lands on ?id=.
    React.useEffect(() => {
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
        const found = all.find((c) => c._id === id);
        if (found) {
            if (!found.isActive) setShowHidden(true);
            openEdit(found);
        } else toast.error('That category no longer exists');
    }, [all, openEdit]);

    const setActive = async (category: Category, isActive: boolean, undoable = true) => {
        const undo = patchCachedRecord<Category>(catalogKeys.categories, category._id, { isActive });
        try {
            await http.put(`/categories/${category._id}`, { isActive });
            toast.success(isActive ? `${category.name} is visible in the app` : `${category.name} is hidden from the app`, {
                description: isActive ? undefined : 'Its products stay in the catalogue. Turn it back on any time.',
                action: undoable ? { label: 'Undo', onClick: () => void setActive({ ...category, isActive }, !isActive, false) } : undefined,
            });
        } catch (error) {
            undo();
            toast.error(`Could not ${isActive ? 'show' : 'hide'} ${category.name}`, { description: errorMessage(error) });
        } finally {
            void invalidateCatalog();
        }
    };

    const saveOrder = async (visibleIds: string[]) => {
        if (!all) return;
        const ids = mergeVisibleOrder(
            all.map((c) => c._id),
            visibleIds,
        );
        const changed = ids
            .map((id, index) => ({ id, index, current: all.find((c) => c._id === id)!.sortOrder }))
            .filter((c) => c.current !== c.index);
        if (!changed.length) return;
        const previous = queryClient.getQueryData<Category[]>(catalogKeys.categories);
        queryClient.setQueryData<Category[]>(catalogKeys.categories, (list) =>
            ids.map((id, index) => ({ ...list!.find((c) => c._id === id)!, sortOrder: index })),
        );
        setSaving(true);
        try {
            await Promise.all(changed.map((c) => http.put(`/categories/${c.id}`, { sortOrder: c.index })));
            toast.success('Category order saved', { description: 'The app shows categories in this order.' });
        } catch (error) {
            queryClient.setQueryData(catalogKeys.categories, previous);
            toast.error('Could not save the new order', { description: errorMessage(error) });
        } finally {
            setSaving(false);
            void invalidateCatalog();
        }
    };

    const moveBy = (category: Category, delta: number) => {
        if (!visible) return;
        const ids = visible.map((c) => c._id);
        const from = ids.indexOf(category._id);
        const to = from + delta;
        if (to < 0 || to >= ids.length) return;
        ids.splice(to, 0, ...ids.splice(from, 1));
        void saveOrder(ids);
    };

    const remove = async (category: Category) => {
        let products: number | undefined;
        try {
            products = await productCountQuery('categoryId', category._id);
        } catch {
            products = undefined;
        }
        const subs = (subcategories.data ?? []).filter((s) => refId(s.parentId) === category._id).length;
        const impact: string[] = [];
        if (products === undefined) impact.push('Could not check how many products use it.');
        else if (products > 0) impact.push(`${pluralize(products, 'product')} filed here will lose their category and drop out of browsing.`);
        else impact.push('No products are filed under it.');
        if (subs > 0) impact.push(`Its ${pluralize(subs, 'subcategory', 'subcategories')} will point to a category that no longer exists.`);
        await confirm({
            title: `Delete “${category.name}”?`,
            description: (
                <>
                    {impact.join(' ')} This cannot be undone.{' '}
                    {category.isActive || (products ?? 0) > 0 ? 'Hiding it instead keeps everything and can be reversed.' : null}
                </>
            ),
            confirmLabel: 'Delete category',
            tone: 'destructive',
            onConfirm: async () => {
                await http.del(`/categories/${category._id}`);
                toast.success(`${category.name} deleted`);
                await invalidateCatalog();
            },
        });
    };

    const onSubmit = async (values: Values) => {
        const body = {
            name: values.name,
            nameHi: values.nameHi,
            group: values.group,
            groupHi: values.groupHi,
            icon: values.icon,
            isActive: values.isActive,
        };
        if (editing) {
            await http.put(`/categories/${editing._id}`, body);
            toast.success(`${values.name} saved`);
        } else {
            const nextOrder = (all ?? []).reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1) + 1;
            await http.post('/categories', { ...body, color: DEFAULT_TILE_COLOR, sortOrder: nextOrder });
            toast.success(`${values.name} created`, { description: 'It is at the end of the list. Drag it to move it.' });
        }
        await invalidateCatalog();
    };

    return (
        <PageContainer>
            <PageHeader
                title="Categories"
                description="The top level of the catalogue. The customer app lists categories in this order."
                actions={
                    canEdit ? (
                        <Button onClick={openCreate}>
                            <Plus aria-hidden />
                            New category
                        </Button>
                    ) : null
                }
            >
                <CatalogNav current="categories" />
            </PageHeader>

            <section aria-labelledby="categories-list-title" className="@container overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
                    <div className="min-w-0">
                        <h2 id="categories-list-title" className="text-sm font-semibold text-foreground">
                            {all ? pluralize(all.length - hiddenCount, 'category', 'categories') + ' in the app' : 'Categories'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {canEdit ? 'Drag the handle, or focus it and use the arrow keys, to change the order.' : 'Only admins can change categories.'}
                        </p>
                    </div>
                    <ShowInactiveToggle checked={showHidden} onCheckedChange={setShowHidden} count={hiddenCount} />
                </div>

                <div
                    role="presentation"
                    className="hidden grid-cols-[2rem_2.5rem_minmax(0,1fr)_10rem_6rem_4.5rem_2rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground @2xl:grid"
                >
                    <span />
                    <span />
                    <span>Name</span>
                    <span>Home group</span>
                    <span className="text-right">Products</span>
                    <span className="text-center">In app</span>
                    <span />
                </div>

                {query.isPending ? (
                    <ListSkeleton />
                ) : query.isError ? (
                    <ErrorState title="Couldn't load categories" error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
                ) : !visible?.length ? (
                    all?.length ? (
                        <EmptyState
                            icon={EyeOff}
                            title="Every category is hidden"
                            description="Turn on “Show hidden” to see them and switch one back on."
                            action={<Button variant="outline" onClick={() => setShowHidden(true)}>Show hidden</Button>}
                        />
                    ) : (
                        <EmptyState
                            icon={FolderTree}
                            title="No categories yet"
                            description="Categories are the first thing customers browse. Create one, then add subcategories under it."
                            action={canEdit ? <Button onClick={openCreate}><Plus aria-hidden />New category</Button> : undefined}
                        />
                    )
                ) : (
                    <SortableList
                        label="Categories in app order"
                        items={visible}
                        getId={getId}
                        getLabel={getName}
                        disabled={!canEdit || saving}
                        onReorder={(ids) => void saveOrder(ids)}
                        className={cn('transition-opacity', query.isFetching && !saving && 'opacity-90')}
                        renderItem={(category, { handle, index }) => (
                            <div className="grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_auto_2rem] items-center gap-3 px-4 py-2.5 @2xl:grid-cols-[2rem_2.5rem_minmax(0,1fr)_10rem_6rem_4.5rem_2rem]">
                                {handle}
                                <Thumb src={category.image || category.icon} name={category.name} className={cn(!category.isActive && 'opacity-50')} />
                                <button
                                    type="button"
                                    onClick={() => canEdit && openEdit(category)}
                                    className="min-w-0 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                                    disabled={!canEdit}
                                    aria-label={`Edit ${category.name}`}
                                >
                                    <BilingualName name={category.name} nameHi={category.nameHi} inactive={!category.isActive} />
                                    <span className="mt-0.5 block text-xs text-muted-foreground @2xl:hidden">
                                        {category.group ? `${category.group} · ` : ''}
                                        {counts[category._id] === undefined ? '' : pluralize(counts[category._id]!, 'product')}
                                    </span>
                                </button>
                                <span className="hidden min-w-0 flex-col @2xl:flex">
                                    {category.group ? (
                                        <>
                                            <span className="truncate text-sm text-foreground">{category.group}</span>
                                            {category.groupHi ? (
                                                <span lang="hi" className="truncate text-xs text-muted-foreground">
                                                    {category.groupHi}
                                                </span>
                                            ) : null}
                                        </>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                </span>
                                <span className="hidden text-right text-sm @2xl:block">
                                    <CountCell value={counts[category._id]} />
                                </span>
                                <span className="flex justify-center">
                                    <ActiveSwitch
                                        name={category.name}
                                        checked={category.isActive}
                                        disabled={!canEdit}
                                        onCheckedChange={(next) => void setActive(category, next)}
                                    />
                                </span>
                                <RowActions
                                    label={category.name}
                                    actions={[
                                        {
                                            label: 'View subcategories',
                                            icon: Tags,
                                            onSelect: () => window.location.assign(`/subcategories?category=${category._id}`),
                                        },
                                        ...(canEdit
                                            ? [
                                                  { label: 'Edit', icon: Pencil, onSelect: () => openEdit(category), separated: true },
                                                  { label: 'Move up', icon: ArrowUp, onSelect: () => moveBy(category, -1), disabled: index === 0 || saving },
                                                  {
                                                      label: 'Move down',
                                                      icon: ArrowDown,
                                                      onSelect: () => moveBy(category, 1),
                                                      disabled: index === visible.length - 1 || saving,
                                                  },
                                                  category.isActive
                                                      ? { label: 'Hide from app', icon: EyeOff, onSelect: () => void setActive(category, false), separated: true }
                                                      : { label: 'Show in app', icon: Eye, onSelect: () => void setActive(category, true), separated: true },
                                                  { label: 'Delete…', icon: Trash2, destructive: true, onSelect: () => void remove(category) },
                                              ]
                                            : []),
                                    ]}
                                />
                            </div>
                        )}
                    />
                )}
            </section>

            <FormSheet
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? `Edit ${editing.name}` : 'New category'}
                description={editing ? undefined : 'Customers see the English and Hindi names on the home screen and in browse.'}
                schema={schema}
                defaultValues={{
                    name: editing?.name ?? '',
                    nameHi: editing?.nameHi ?? '',
                    group: editing?.group ?? '',
                    groupHi: editing?.groupHi ?? '',
                    icon: editing?.icon ?? '',
                    isActive: editing?.isActive ?? true,
                }}
                submitLabel={editing ? 'Save changes' : 'Create category'}
                onSubmit={onSubmit}
            >
                {(form) => (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField form={form} name="name" label="Name (English)" autoComplete="off" placeholder="Dairy & Eggs" />
                            <TextField form={form} name="nameHi" label="Name (Hindi)" lang="hi" autoComplete="off" placeholder="डेयरी और अंडे" />
                        </div>
                        <ImageField
                            form={form}
                            name="icon"
                            label="Tile image"
                            previewName={form.watch('name')}
                            description="A transparent product shot reads best on the tile. Paste a link or upload one under 1 MB."
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField
                                form={form}
                                name="group"
                                label="Home group"
                                list="category-groups"
                                autoComplete="off"
                                placeholder="Grocery & Kitchen"
                                description="Categories with the same group sit together on the home screen."
                            />
                            <TextField form={form} name="groupHi" label="Home group (Hindi)" lang="hi" autoComplete="off" />
                        </div>
                        <datalist id="category-groups">
                            {groups.map((g) => (
                                <option key={g} value={g} />
                            ))}
                        </datalist>
                        <SwitchField
                            form={form}
                            name="isActive"
                            label="Show in the app"
                            description="Hidden categories keep their products and can be turned back on."
                        />
                    </>
                )}
            </FormSheet>
        </PageContainer>
    );
}

const getId = (c: { _id: string }) => c._id;
const getName = (c: { name: string }) => c.name;

function ListSkeleton() {
    return (
        <ul aria-hidden className="divide-y">
            {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-6" />
                    <Skeleton className="size-10 rounded-[10px]" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4.5 w-8 rounded-full" />
                </li>
            ))}
        </ul>
    );
}

export default withProviders(CategoriesPage);
