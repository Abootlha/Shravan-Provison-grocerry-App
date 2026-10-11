import * as React from 'react';
import {
    type Column,
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type OnChangeFn,
    type PaginationState,
    type Row,
    type RowData,
    type RowSelectionState,
    type SortingState,
    type Table as TanstackTable,
    useReactTable,
    type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from './EmptyState';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        /** Visible name in the column toggle when the header is not a plain string. */
        label?: string;
        /** Right-align numbers and money. */
        align?: 'left' | 'right' | 'center';
        /** Extra classes for this column's cells (e.g. a min width). */
        className?: string;
        headerClassName?: string;
    }
}

export interface DataTableProps<TData, TValue = unknown> {
    columns: ColumnDef<TData, TValue>[];
    /** undefined while the first load is in flight. */
    data: TData[] | undefined;
    /** Stable id per row (keeps selection across pages). Defaults to row._id ?? row.id ?? index. */
    getRowId?: (row: TData, index: number) => string;

    /* Server-side mode: pass pagination + rowCount (or pageCount) and the table stops paginating locally. */
    pagination?: PaginationState;
    onPaginationChange?: OnChangeFn<PaginationState>;
    /** Total rows on the server (preferred). */
    rowCount?: number;
    /** Total pages on the server, when rowCount is unknown. */
    pageCount?: number;
    sorting?: SortingState;
    /** Passing this makes sorting server-side. */
    onSortingChange?: OnChangeFn<SortingState>;
    columnFilters?: ColumnFiltersState;
    /** Passing this makes filtering server-side. */
    onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;

    /* Selection */
    enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    /** Rendered in the bar that replaces the toolbar while rows are selected. */
    bulkActions?: (selected: TData[], clearSelection: () => void) => React.ReactNode;

    /* Visibility */
    columnVisibility?: VisibilityState;
    onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
    /** Show the "Columns" menu. Default true. */
    enableColumnToggle?: boolean;

    /* States */
    /** First load: skeleton rows. */
    loading?: boolean;
    /** Background refetch: the table dims slightly, rows stay. */
    fetching?: boolean;
    error?: unknown;
    onRetry?: () => void;
    /** Shown when there are no rows. Pass an <EmptyState> that says why and what to do. */
    empty?: React.ReactNode;

    /* Layout */
    /** Left side of the toolbar: search, filters. */
    toolbar?: React.ReactNode;
    /** Right side of the toolbar, before the Columns menu. */
    toolbarActions?: React.ReactNode;
    onRowClick?: (row: TData) => void;
    pageSizeOptions?: number[];
    /** Scroll area height cap; the header sticks inside it. Default: viewport minus chrome. */
    maxHeight?: string;
    /** Accessible name for the table. */
    label: string;
    className?: string;
}

function defaultRowId(row: unknown, index: number) {
    const r = row as { _id?: unknown; id?: unknown };
    return String(r?._id ?? r?.id ?? index);
}

/** A sortable header: <DataTableColumnHeader column={column} title="Price" /> */
export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: {
    column: Column<TData, TValue>;
    title: string;
    className?: string;
}) {
    if (!column.getCanSort()) return <span className={className}>{title}</span>;
    const sorted = column.getIsSorted();
    const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;
    const right = column.columnDef.meta?.align === 'right';
    return (
        <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className={cn(
                '-mx-2 inline-flex h-8 items-center gap-1 rounded-md px-2 font-medium hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                right && 'flex-row-reverse',
                sorted && 'text-foreground',
                className,
            )}
            aria-label={`${title}: ${sorted === 'asc' ? 'sorted ascending' : sorted === 'desc' ? 'sorted descending' : 'not sorted'}. Activate to change sorting.`}
        >
            {title}
            <Icon className={cn('size-3.5', !sorted && 'opacity-50')} aria-hidden />
        </button>
    );
}

/** Checkbox column for row selection. Put it first in `columns`. */
export function selectColumn<TData>(): ColumnDef<TData> {
    return {
        id: 'select',
        size: 40,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all rows on this page"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                onClick={(event) => event.stopPropagation()}
                aria-label="Select row"
            />
        ),
        meta: { className: 'w-10', headerClassName: 'w-10' },
    };
}

export function DataTable<TData, TValue = unknown>({
    columns,
    data,
    getRowId = defaultRowId,
    pagination: paginationProp,
    onPaginationChange,
    rowCount,
    pageCount,
    sorting: sortingProp,
    onSortingChange,
    columnFilters: filtersProp,
    onColumnFiltersChange,
    enableRowSelection = false,
    rowSelection: selectionProp,
    onRowSelectionChange,
    bulkActions,
    columnVisibility: visibilityProp,
    onColumnVisibilityChange,
    enableColumnToggle = true,
    loading,
    fetching,
    error,
    onRetry,
    empty,
    toolbar,
    toolbarActions,
    onRowClick,
    pageSizeOptions = [10, 20, 50, 100],
    maxHeight = 'calc(100dvh - 15rem)',
    label,
    className,
}: DataTableProps<TData, TValue>) {
    const serverPaging = paginationProp !== undefined && onPaginationChange !== undefined;
    const [localPagination, setLocalPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: pageSizeOptions[0] ?? 10 });
    const [localSorting, setLocalSorting] = React.useState<SortingState>([]);
    const [localFilters, setLocalFilters] = React.useState<ColumnFiltersState>([]);
    const [localSelection, setLocalSelection] = React.useState<RowSelectionState>({});
    const [localVisibility, setLocalVisibility] = React.useState<VisibilityState>({});

    const rows = React.useMemo(() => data ?? [], [data]);

    const table = useReactTable<TData>({
        data: rows,
        columns: columns as ColumnDef<TData, unknown>[],
        getRowId,
        state: {
            pagination: paginationProp ?? localPagination,
            sorting: sortingProp ?? localSorting,
            columnFilters: filtersProp ?? localFilters,
            rowSelection: selectionProp ?? localSelection,
            columnVisibility: visibilityProp ?? localVisibility,
        },
        onPaginationChange: onPaginationChange ?? setLocalPagination,
        onSortingChange: onSortingChange ?? setLocalSorting,
        onColumnFiltersChange: onColumnFiltersChange ?? setLocalFilters,
        onRowSelectionChange: onRowSelectionChange ?? setLocalSelection,
        onColumnVisibilityChange: onColumnVisibilityChange ?? setLocalVisibility,
        enableRowSelection,
        manualPagination: serverPaging,
        manualSorting: onSortingChange !== undefined,
        manualFiltering: onColumnFiltersChange !== undefined,
        rowCount: serverPaging ? rowCount : undefined,
        pageCount: serverPaging && rowCount === undefined ? (pageCount ?? -1) : undefined,
        autoResetPageIndex: false,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(),
        getFilteredRowModel: onColumnFiltersChange ? undefined : getFilteredRowModel(),
        getPaginationRowModel: serverPaging ? undefined : getPaginationRowModel(),
    });

    const selected = table.getSelectedRowModel().flatRows.map((r) => r.original);
    const clearSelection = () => table.resetRowSelection();
    const visibleColumns = table.getVisibleLeafColumns();
    const pageRows = table.getRowModel().rows;
    const showSkeleton = loading && rows.length === 0;
    const showError = !showSkeleton && error !== undefined && error !== null && rows.length === 0;
    const showEmpty = !showSkeleton && !showError && pageRows.length === 0;

    const hasToolbar = toolbar || toolbarActions || enableColumnToggle || (bulkActions && enableRowSelection);

    return (
        <div className={cn('min-w-0 overflow-hidden rounded-xl border bg-card', className)}>
            {hasToolbar ? (
                <div className="flex min-h-14 flex-wrap items-center gap-2 border-b px-3 py-2.5">
                    {selected.length > 0 && bulkActions ? (
                        <div className="flex w-full flex-wrap items-center gap-2" role="region" aria-label="Bulk actions">
                            <span className="text-sm font-semibold tabular-nums">{formatNumber(selected.length)} selected</span>
                            <div className="flex flex-wrap items-center gap-2">{bulkActions(selected, clearSelection)}</div>
                            <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
                                <X aria-hidden />
                                Clear
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
                            <div className="flex items-center gap-2">
                                {toolbarActions}
                                {enableColumnToggle ? <ColumnToggle table={table} /> : null}
                            </div>
                        </>
                    )}
                </div>
            ) : null}

            <div
                className={cn('relative overflow-auto transition-opacity duration-150', fetching && !showSkeleton && 'opacity-70')}
                style={{ maxHeight }}
                aria-busy={loading || fetching || undefined}
            >
                <table data-slot="table" aria-label={label} className="w-full caption-bottom text-sm tabular-nums">
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    const meta = header.column.columnDef.meta;
                                    const sorted = header.column.getIsSorted();
                                    return (
                                        <TableHead
                                            key={header.id}
                                            aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                                            className={cn(
                                                'h-10 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground',
                                                meta?.align === 'right' && 'text-right',
                                                meta?.align === 'center' && 'text-center',
                                                meta?.headerClassName,
                                            )}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {showSkeleton
                            ? Array.from({ length: Math.min(table.getState().pagination.pageSize, 8) }).map((_, i) => (
                                  <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                                      {visibleColumns.map((column) => (
                                          <TableCell key={column.id} className="h-12 px-3">
                                              <Skeleton className={cn('h-4', column.id === 'select' ? 'size-4' : i % 2 ? 'w-3/4' : 'w-1/2')} />
                                          </TableCell>
                                      ))}
                                  </TableRow>
                              ))
                            : null}
                        {showError ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={visibleColumns.length} className="p-0">
                                    <ErrorState title={`Couldn't load ${label.toLowerCase()}`} error={error} onRetry={onRetry} />
                                </TableCell>
                            </TableRow>
                        ) : null}
                        {showEmpty ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={visibleColumns.length} className="p-0 whitespace-normal">
                                    {empty ?? <EmptyState title="Nothing here yet" />}
                                </TableCell>
                            </TableRow>
                        ) : null}
                        {!showSkeleton && !showError
                            ? pageRows.map((row) => (
                                  <TableRow
                                      key={row.id}
                                      data-state={row.getIsSelected() ? 'selected' : undefined}
                                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                                      className={cn(
                                          'data-[state=selected]:bg-brand-tint/60',
                                          onRowClick && 'cursor-pointer',
                                      )}
                                  >
                                      {row.getVisibleCells().map((cell) => {
                                          const meta = cell.column.columnDef.meta;
                                          return (
                                              <TableCell
                                                  key={cell.id}
                                                  className={cn(
                                                      'h-12 px-3',
                                                      meta?.align === 'right' && 'text-right',
                                                      meta?.align === 'center' && 'text-center',
                                                      meta?.className,
                                                  )}
                                              >
                                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                              </TableCell>
                                          );
                                      })}
                                  </TableRow>
                              ))
                            : null}
                    </TableBody>
                </table>
            </div>

            <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} serverRowCount={serverPaging ? rowCount : undefined} />
        </div>
    );
}

function ColumnToggle<TData>({ table }: { table: TanstackTable<TData> }) {
    const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
    if (hideable.length === 0) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Columns3 aria-hidden />
                    <span className="hidden sm:inline">Columns</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((column) => {
                    const header = column.columnDef.header;
                    const name = column.columnDef.meta?.label ?? (typeof header === 'string' ? header : column.id);
                    return (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                            onSelect={(event) => event.preventDefault()}
                        >
                            {name}
                        </DropdownMenuCheckboxItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DataTablePagination<TData>({
    table,
    pageSizeOptions,
    serverRowCount,
}: {
    table: TanstackTable<TData>;
    pageSizeOptions: number[];
    serverRowCount?: number;
}) {
    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();
    const total = serverRowCount ?? table.getFilteredRowModel().rows.length;
    const from = total === 0 ? 0 : pageIndex * pageSize + 1;
    const to = Math.min((pageIndex + 1) * pageSize, total);
    const knownTotal = serverRowCount !== undefined || table.options.manualPagination !== true;
    const labelId = React.useId();

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-3 py-2.5 text-sm">
            <p className="text-muted-foreground tabular-nums" aria-live="polite">
                {knownTotal ? (
                    total === 0 ? (
                        'No rows'
                    ) : (
                        <>
                            {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
                        </>
                    )
                ) : (
                    <>Page {formatNumber(pageIndex + 1)}{pageCount > 0 ? ` of ${formatNumber(pageCount)}` : ''}</>
                )}
            </p>
            <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-muted-foreground" id={labelId}>
                        Rows
                    </span>
                    <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
                        <SelectTrigger size="sm" className="w-[4.5rem]" aria-labelledby={labelId}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label="Previous page"
                >
                    <ChevronLeft aria-hidden />
                </Button>
                <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label="Next page"
                >
                    <ChevronRight aria-hidden />
                </Button>
            </div>
        </div>
    );
}
