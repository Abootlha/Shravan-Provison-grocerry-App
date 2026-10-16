import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ScrapeStatus } from './types';

const STATUS: Record<ScrapeStatus, { label: string; variant: 'neutral' | 'brand' | 'warning' | 'success' | 'destructive'; spin?: boolean }> = {
    queued: { label: 'Queued', variant: 'neutral', spin: true },
    scraping: { label: 'Scraping', variant: 'brand', spin: true },
    ready: { label: 'To review', variant: 'warning' },
    failed: { label: 'Failed', variant: 'destructive' },
    approving: { label: 'Approving', variant: 'brand', spin: true },
    approved: { label: 'Approved', variant: 'success' },
    declined: { label: 'Declined', variant: 'neutral' },
};

export function ScrapeStatusBadge({ status }: { status: ScrapeStatus }) {
    const def = STATUS[status] ?? { label: status, variant: 'neutral' as const };
    return (
        <Badge variant={def.variant}>
            {def.spin ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {def.label}
        </Badge>
    );
}
