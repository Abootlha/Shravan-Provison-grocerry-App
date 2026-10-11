# Shared building blocks

Everything a page needs besides its own logic. Import from `@/components/shared` (barrel) or the
individual files. Primitives (Button, Input, Dialog…) live in `@/components/ui`.

## Page skeleton

Each Astro page renders inside `AdminLayout`, which mounts the shell island (sidebar, header,
breadcrumbs, command palette, toasts, confirm dialogs). A page adds **one** React island:

```astro
---
import AdminLayout from "../layouts/AdminLayout.astro";
import OrdersPage from "../components/orders/OrdersPage";
---
<AdminLayout title="Orders">
  <OrdersPage client:load />
</AdminLayout>
```

```tsx
import { withProviders, PageContainer, PageHeader } from '@/components/shared';

function OrdersPage() {
  return (
    <PageContainer>
      <PageHeader title="Live orders" description="Orders that still need action." actions={<Button>Export</Button>} />
      {/* … */}
    </PageContainer>
  );
}
export default withProviders(OrdersPage);
```

`withProviders` / `<Providers>` gives the island the page-wide QueryClient and the tooltip provider.
Every island must use it; they all share one cache (`@/lib/query`), so a mutation in one island can
invalidate queries in another.

- `PageContainer`: max width 1400px, responsive padding, 24px vertical rhythm.
- `PageHeader({ title, description?, actions?, children? })`: the page's only `<h1>`. `children` is a
  row under the title for tabs or filters. Breadcrumbs come from the shell (derived from the nav).

## Data: React Query + http

```ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { http } from '@/lib/http';          // get / post / put / patch / del
import { queryClient, queryKeys } from '@/lib/query';

const orders = useQuery({
  queryKey: queryKeys.orders.list({ page, status }),
  queryFn: () => http.get<OrdersResponse>('/admin/orders', { params: { page, status } }),
  placeholderData: (prev) => prev,          // keep rows while paging
});

const update = useMutation({
  mutationFn: (v: { id: string; status: string }) => http.patch(`/admin/orders/${v.id}/status`, { status: v.status }),
  onSuccess: () => { toast.success('Order updated'); queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }); },
  onError: (e) => toast.error('Could not update the order', { description: errorMessage(e) }),
});
```

- Defaults: `staleTime` 30s, one retry for network/5xx only, refetch on window focus.
- Every failure is an `ApiError { status, code?, message, messages[] }`. `message` is human readable
  (from the backend `message`, joined if it is a list) and safe to show. Never print raw JSON.
- `401` refreshes the session once (shared with the page guard, so only one `/auth/refresh` per
  load); if that fails the user goes to `/login?reason=…`. `403` keeps the session and shows a
  "You don't have permission" toast automatically; you only handle the UI state.
- `errorMessage(err)` turns anything thrown into a sentence.
- The old `api.*` object in `@/lib/api` still works for unconverted pages; prefer `http` in new code.

## Feedback

- Toasts: `import { toast } from 'sonner'` → `toast.success('Saved')`, `toast.error(title, { description })`.
  The Toaster is mounted once by the shell. Do not use `alert()`.
- Confirm: `const confirm = useConfirm();` then
  ```ts
  const ok = await confirm({
    title: 'Delete "Amul Taaza 1L"?',
    description: 'Customers will no longer see it. Past orders keep their copy.',
    confirmLabel: 'Delete product',
    tone: 'destructive',
    onConfirm: () => http.del(`/products/${id}`),   // optional: dialog shows a spinner and inline error
  });
  ```
  Resolves `true` once confirmed (and `onConfirm` succeeded), `false` on cancel. Never use
  `window.confirm()`. `ConfirmDialog` is the controlled version if you need your own state.

## DataTable

TanStack Table v8 + shadcn table. Scrolls horizontally inside its own card (never the page), header
sticks inside the scroll area, skeleton rows on first load, dims while refetching.

```tsx
const columns: ColumnDef<Order>[] = [
  selectColumn<Order>(),
  { accessorKey: 'orderId', header: 'Order', meta: { className: 'font-medium' } },
  { accessorKey: 'totalAmount', header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    cell: ({ row }) => <Money value={row.original.totalAmount} />, meta: { align: 'right', label: 'Total' } },
  { accessorKey: 'orderStatus', header: 'Status', cell: ({ getValue }) => <StatusBadge kind="order" status={getValue<string>()} /> },
  { accessorKey: 'createdAt', header: 'Placed', cell: ({ getValue }) => <DateTime value={getValue<string>()} format="relative" /> },
];

<DataTable
  label="Orders"
  columns={columns}
  data={query.data?.orders}
  loading={query.isPending}
  fetching={query.isFetching}
  error={query.error ?? undefined}
  onRetry={() => query.refetch()}
  // server-side paging: pass all three
  pagination={pagination} onPaginationChange={setPagination} rowCount={query.data?.total}
  // optional server-side sorting / filtering: passing the handler switches it to manual
  sorting={sorting} onSortingChange={setSorting}
  enableRowSelection
  bulkActions={(rows, clear) => <Button size="sm" onClick={() => markPacked(rows).then(clear)}>Mark packed</Button>}
  toolbar={<Input placeholder="Search orders" className="w-64" … />}
  toolbarActions={<Button variant="outline" size="sm">Export CSV</Button>}
  empty={<EmptyState icon={Inbox} title="No live orders" description="New orders appear here as they come in." />}
  onRowClick={(order) => openDetail(order._id)}
/>
```

Without `pagination`/`onPaginationChange` the table paginates, sorts and filters locally.
Column `meta`: `label` (name in the Columns menu), `align: 'right'` for numbers/money,
`className`, `headerClassName`. Rows are keyed by `_id ?? id` (override with `getRowId`) so
selection survives paging.

## StatCard

```tsx
<StatCard label="Revenue today" value={data?.revenue} format="money" loading={isPending} href="/analytics" />
<StatCard label="Orders today" value={data?.orders} delta={{ value: 12.5, period: 'vs yesterday' }} />
```

`value` must come from the API; `null`/`undefined` renders "—", never a sample number. `delta` is
optional and only rendered when you pass it, and it requires the real comparison `period`. Numbers
count up once on first view (beUI animated-number), static under reduced motion.

## States

- `EmptyState({ icon?, title, description?, action?, size?: 'inline' | 'page' })`: say why it is empty
  and offer the one action that fills it. Filtered-to-nothing and first-run are different copy.
- `ErrorState({ title?, error?, onRetry?, retrying? })`: shows `errorMessage(error)` and a retry button.
- `BeingBuilt`: the placeholder used by unbuilt routes. Replace it, do not add numbers to it.

## Forms (react-hook-form + zod)

```tsx
const schema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters'),
  price: z.number({ message: 'Enter a price' }).positive('Price must be more than 0'),
  categoryId: z.string().min(1, 'Choose a category'),
  isActive: z.boolean(),
});

<FormDialog            // or <FormSheet> for longer forms (scrolling body, fixed footer)
  open={open} onOpenChange={setOpen}
  title={editing ? 'Edit category' : 'New category'}
  schema={schema}
  defaultValues={{ name: editing?.name ?? '', price: undefined, categoryId: '', isActive: true }}
  submitLabel={editing ? 'Save changes' : 'Create category'}
  onSubmit={async (values) => { await http.post('/categories', values); toast.success('Category created'); }}
>
  {(form) => (
    <>
      <TextField form={form} name="name" label="Name" />
      <TextField form={form} name="price" label="Price (₹)" type="number" inputMode="decimal" />
      <SelectField form={form} name="categoryId" label="Category" options={categories} />
      <SwitchField form={form} name="isActive" label="Visible in the app" description="Hidden items stay in the catalogue." />
      <TextareaField form={form} name="description" label="Description" />
    </>
  )}
</FormDialog>
```

- Throwing from `onSubmit` keeps the dialog open; an `ApiError` whose message starts with a field
  name ("name must be…") is attached to that field, anything else appears above the buttons.
- Validation runs on blur, then on change. Labels, `aria-invalid` and `aria-describedby` are wired.
- For custom layouts use `useZodForm(schema, defaults)` + `applyServerError(form, error)` directly.

## Status and formatting

- `StatusBadge({ kind: 'order' | 'payment' | 'product' | 'stock' | 'rider', status })`: consistent
  colour and label (`ORDER_STATUS`, `PAYMENT_STATUS`, …). Brand violet marks orders in motion,
  amber needs attention, green done, red cancelled/failed. Unknown values render neutral.
- `stockStatus(qty)` with `LOW_STOCK_THRESHOLD = 10` (≤ 10 is low, 0 is out). Use it everywhere.
- `<Money value={…} />` (₹ with Indian grouping, paise only when present; `compact` for axes) and
  `<DateTime value={…} format="date|time|datetime|relative" />` (always Asia/Kolkata, `<time>` with
  the full timestamp as a tooltip). Plain functions in `@/lib/format`: `formatMoney`,
  `formatNumber`, `formatDate`, `formatDateTime`, `formatRelative`, `storeDayKey`.

## Command palette

The shell's ⌘K / Ctrl K palette lists every page plus "New product" (`/products?action=new`) and
"New category" (`/categories?action=new`). **Products and Categories pages must open their create
form when `?action=new` is present** (then remove the param with `history.replaceState`).

Pages can add commands or live search while mounted:

```ts
import { registerCommands, registerSearchProvider, openCommandPalette } from '@/components/shell/command-registry';

useEffect(() => registerSearchProvider({
  id: 'products', group: 'Products', minQueryLength: 2,
  search: async (q, signal) => (await http.get<ProductsResponse>('/products', { params: { search: q, limit: 8 }, signal }))
    .products.map((p) => ({ id: p._id, label: p.name, group: 'Products', hint: p.sku, href: `/products?id=${p._id}` })),
}), []);
```

## Theme and tokens

Light/dark/system is stored in `localStorage['admin-theme']` and applied before paint. Use the
Tailwind tokens, never hex values: `bg-background` (canvas), `bg-card`, `bg-muted`,
`text-foreground`, `text-muted-foreground`, `border`, `bg-primary` / `text-brand-text` (violet,
only for actions and selection), `bg-brand-tint` (selected row/chip), `text-success-text` +
`bg-success-tint`, `text-warning` + `bg-warning-tint`, `text-destructive` + `bg-destructive-tint`,
`chart-1…5`, `shadow-float` (only for things that float), `tabular-nums`. Cards are flat with a
hairline; no gradients, glow or blur.
