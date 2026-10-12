import * as React from 'react';
import type { PaginationState, SortingState } from '@tanstack/react-table';

/**
 * Sorting and paging done here (not inside DataTable) so filters can live in the table's own
 * toolbar and still send the user back to page 1 when they change — without remounting the
 * table and stealing focus from the search box.
 */
export function useClientTable<T>({
    rows,
    sortValue,
    resetKey,
    pageSize = 20,
}: {
    rows: T[] | undefined;
    sortValue: (row: T, columnId: string) => string | number;
    resetKey: string;
    pageSize?: number;
}) {
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });
    const [sorting, setSorting] = React.useState<SortingState>([]);

    React.useEffect(() => {
        setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
    }, [resetKey, sorting]);

    const sorted = React.useMemo(() => {
        if (!rows) return undefined;
        const rule = sorting[0];
        if (!rule) return rows;
        const dir = rule.desc ? -1 : 1;
        return [...rows].sort((a, b) => {
            const av = sortValue(a, rule.id);
            const bv = sortValue(b, rule.id);
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'en-IN', { sensitivity: 'base', numeric: true }) * dir;
        });
    }, [rows, sorting, sortValue]);

    // Keep the page in range when the list shrinks (e.g. after a delete).
    const total = sorted?.length ?? 0;
    const lastPage = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
    const pageIndex = Math.min(pagination.pageIndex, lastPage);
    const pageRows = sorted?.slice(pageIndex * pagination.pageSize, (pageIndex + 1) * pagination.pageSize);

    return {
        data: pageRows,
        rowCount: total,
        pagination: pageIndex === pagination.pageIndex ? pagination : { ...pagination, pageIndex },
        onPaginationChange: setPagination,
        sorting,
        onSortingChange: setSorting,
    };
}
