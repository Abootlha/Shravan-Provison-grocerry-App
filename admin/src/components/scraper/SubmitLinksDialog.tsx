import * as React from 'react';
import { toast } from 'sonner';
import { Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/http';
import { HierarchyPicker, type HierarchyValue } from './HierarchyPicker';
import { invalidateScraper, parseLinks, scraperApi } from './api';

const MAX_LINKS = 100;
const EMPTY: HierarchyValue = { categoryId: null, subcategoryId: null, itemGroupId: null };

export function SubmitLinksDialog({
    open,
    onOpenChange,
    onSubmitted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmitted: () => void;
}) {
    const [text, setText] = React.useState('');
    const [hierarchy, setHierarchy] = React.useState<HierarchyValue>(EMPTY);
    const [saving, setSaving] = React.useState(false);
    const { urls, invalid } = React.useMemo(() => parseLinks(text), [text]);

    React.useEffect(() => {
        if (!open) {
            setText('');
            setHierarchy(EMPTY);
        }
    }, [open]);

    const tooMany = urls.length > MAX_LINKS;

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (!urls.length || tooMany) return;
        setSaving(true);
        try {
            const result = await scraperApi.submit({
                urls,
                categoryId: hierarchy.categoryId ?? undefined,
                subcategoryId: hierarchy.subcategoryId ?? undefined,
                itemGroupId: hierarchy.itemGroupId ?? undefined,
            });
            await invalidateScraper();
            if (result.queued) {
                toast.success(`Scraping ${result.queued} ${result.queued === 1 ? 'link' : 'links'}`, {
                    description: result.skipped.length
                        ? `${result.skipped.length} skipped: ${result.skipped[0].reason.toLowerCase()}${result.skipped.length > 1 ? ' and others' : ''}.`
                        : 'Previews appear under "In progress" and move to "To review" when ready.',
                });
            } else {
                toast.info('Nothing new to scrape', {
                    description: result.skipped.map((s) => s.reason).filter((r, i, a) => a.indexOf(r) === i).join(', '),
                });
            }
            onOpenChange(false);
            onSubmitted();
        } catch (error) {
            toast.error('Could not start scraping', { description: errorMessage(error) });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>Scrape product links</DialogTitle>
                        <DialogDescription>
                            Paste product page links, one per line. Each one becomes a preview with photos, prices and a
                            suggested category. Nothing reaches the store until you approve it.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <Label htmlFor="scrape-links">Product links</Label>
                        <Textarea
                            id="scrape-links"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={8}
                            autoFocus
                            spellCheck={false}
                            placeholder={'https://blinkit.com/prn/amul-taaza-toned-milk/prid/123\nhttps://…'}
                            className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                            {urls.length} {urls.length === 1 ? 'link' : 'links'}
                            {invalid.length ? ` · ${invalid.length} not a link (ignored)` : ''}
                            {tooMany ? ` · at most ${MAX_LINKS} at a time` : ''}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">File them under (optional)</p>
                        <p className="text-xs text-muted-foreground">
                            Leave empty to let the scraper suggest a category for each product.
                        </p>
                        <HierarchyPicker value={hierarchy} onChange={setHierarchy} idPrefix="submit" />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!urls.length || tooMany || saving}>
                            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
                            Scrape {urls.length || ''} {urls.length === 1 ? 'link' : 'links'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
