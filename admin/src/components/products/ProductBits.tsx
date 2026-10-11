import * as React from 'react';
import { ImageOff, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ISSUE_LABEL, productUnit, type AdminProduct, type ProductIssue, type StockState } from './types';

/** Square pack-shot well. Product photos are the colour on the page, so the well stays neutral. */
export function ProductThumb({ src, alt, size, className }: { src?: string; alt: string; size?: number; className?: string }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);
    return (
        <span
            className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border bg-muted', className)}
            style={size ? { width: size, height: size } : undefined}
        >
            {src && !failed ? (
                <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-contain p-0.5" onError={() => setFailed(true)} />
            ) : src ? (
                <ImageOff className="size-4 text-muted-foreground" aria-label="Image failed to load" />
            ) : (
                <Package className="size-4 text-muted-foreground" aria-label="No image" />
            )}
        </span>
    );
}

/** What is wrong with a product, in words. The unit issue quotes the offending value. */
export function issueText(issue: ProductIssue, product?: Pick<AdminProduct, 'unit' | 'pack'>): string {
    if (issue === 'unit_looks_like_barcode' && product) {
        const unit = productUnit(product as AdminProduct).replace(/\s+/g, ' ').trim();
        return `Unit “${unit}” looks like a barcode`;
    }
    return ISSUE_LABEL[issue] ?? issue;
}

export function IssueBadges({ product, className }: { product: AdminProduct; className?: string }) {
    const issues = product.issues ?? [];
    if (!issues.length) return null;
    return (
        <span className={cn('flex flex-wrap gap-1', className)}>
            {issues.map((issue) => (
                <Badge key={issue} variant="warning" className="max-w-[16rem] truncate font-medium">
                    {issueText(issue, product)}
                </Badge>
            ))}
        </span>
    );
}

/** Stock number with its state against the product's own reorder level. */
export function StockCell({ stock, reorderLevel, state }: { stock: number; reorderLevel?: number; state?: StockState }) {
    const level = reorderLevel ?? 10;
    const resolved: StockState = state ?? (stock <= 0 ? 'out' : stock <= level ? 'low' : 'ok');
    const label = resolved === 'out' ? 'Out' : resolved === 'low' ? 'Low' : null;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                    {label ? (
                        <Badge variant={resolved === 'out' ? 'destructive' : 'warning'} className="h-5 px-1.5">
                            {label}
                        </Badge>
                    ) : null}
                    <span className={cn('font-semibold', resolved === 'out' && 'text-destructive')}>{formatNumber(stock)}</span>
                </span>
            </TooltipTrigger>
            <TooltipContent side="left">Reorder at {formatNumber(level)} or fewer</TooltipContent>
        </Tooltip>
    );
}
