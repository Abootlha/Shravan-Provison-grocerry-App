import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryClient } from '@/lib/query';
import { invalidateProducts } from '@/components/products/data';
import type {
    BulkResult,
    ScrapeCounts,
    ScrapedEdits,
    ScrapedItem,
    ScrapedListResponse,
    ScraperStatus,
    ScrapeTab,
    SubmitResult,
} from './types';

export const scraperKeys = {
    all: ['scraper'] as const,
    list: (params: object) => ['scraper', 'list', params] as const,
    counts: ['scraper', 'counts'] as const,
    status: ['scraper', 'status'] as const,
    detail: (id: string) => ['scraper', 'detail', id] as const,
};

export interface ScrapeListParams {
    status: ScrapeTab;
    page: number;
    limit: number;
    q?: string;
}

/** Polls while links are still being scraped so previews appear on their own. */
export function useScrapeCounts() {
    return useQuery({
        queryKey: scraperKeys.counts,
        queryFn: ({ signal }) => http.get<ScrapeCounts>('/admin/scraper/counts', { signal }),
        refetchInterval: (query) => ((query.state.data?.in_progress ?? 0) > 0 ? 3000 : 30_000),
    });
}

export function useScrapedItems(params: ScrapeListParams, polling: boolean) {
    return useQuery({
        queryKey: scraperKeys.list(params),
        queryFn: ({ signal }) => http.get<ScrapedListResponse>('/admin/scraper/items', { params: { ...params }, signal }),
        placeholderData: (prev) => prev,
        refetchInterval: polling ? 3000 : false,
    });
}

export function useScrapedItem(id: string | null) {
    return useQuery({
        queryKey: scraperKeys.detail(id ?? ''),
        queryFn: ({ signal }) => http.get<{ item: ScrapedItem }>(`/admin/scraper/items/${id}`, { signal }).then((r) => r.item),
        enabled: !!id,
        staleTime: 0,
    });
}

export function useScraperStatus() {
    return useQuery({
        queryKey: scraperKeys.status,
        queryFn: ({ signal }) => http.get<ScraperStatus>('/admin/scraper/status', { signal }),
        staleTime: 5 * 60_000,
    });
}

export function invalidateScraper() {
    return queryClient.invalidateQueries({ queryKey: scraperKeys.all });
}

export const scraperApi = {
    submit: (body: { urls: string[]; categoryId?: string; subcategoryId?: string; itemGroupId?: string }) =>
        http.post<SubmitResult>('/admin/scraper/items', body),
    update: (id: string, body: ScrapedEdits) => http.patch<{ item: ScrapedItem }>(`/admin/scraper/items/${id}`, body),
    approve: async (id: string, body: ScrapedEdits & { publishAs?: 'active' | 'draft' }) => {
        const result = await http.post<{ item: ScrapedItem }>(`/admin/scraper/items/${id}/approve`, body);
        void invalidateProducts();
        return result;
    },
    decline: (id: string, reason?: string) => http.post<{ item: ScrapedItem }>(`/admin/scraper/items/${id}/decline`, { reason }),
    delete: (id: string) => http.del<{ ok: boolean; id: string }>(`/admin/scraper/items/${id}`),
    retry: (id: string) => http.post<{ item: ScrapedItem }>(`/admin/scraper/items/${id}/retry`),
    bulkApprove: async (ids: string[], publishAs: 'active' | 'draft') => {
        const result = await http.post<BulkResult>('/admin/scraper/items/bulk-approve', { ids, publishAs });
        void invalidateProducts();
        return result;
    },
    bulkDecline: (ids: string[], reason?: string) => http.post<BulkResult>('/admin/scraper/items/bulk-decline', { ids, reason }),
    bulkDelete: (ids: string[]) => http.post<{ ok: boolean; deleted: number }>('/admin/scraper/items/bulk-delete', { ids }),
    clearDeclined: () => http.post<{ ok: boolean; deleted: number }>('/admin/scraper/items/clear-declined'),
    importCsv: (body: {
        rows: Record<string, any>[];
        categoryId?: string;
        subcategoryId?: string;
        itemGroupId?: string;
    }) => http.post<{ batchId: string; imported: number; skipped: number }>('/admin/scraper/import-csv', body),
};

/** Splits pasted text into candidate links (one per line, or space/comma separated). */
export function parseLinks(text: string): { urls: string[]; invalid: string[] } {
    const urls: string[] = [];
    const invalid: string[] = [];
    for (const token of text.split(/[\s,]+/)) {
        const value = token.trim();
        if (!value) continue;
        try {
            const url = new URL(value);
            if (url.protocol === 'http:' || url.protocol === 'https:') urls.push(value);
            else invalid.push(value);
        } catch {
            invalid.push(value);
        }
    }
    return { urls: [...new Set(urls)], invalid };
}
