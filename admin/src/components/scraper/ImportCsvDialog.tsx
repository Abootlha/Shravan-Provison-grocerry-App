import * as React from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/http';
import { HierarchyPicker, type HierarchyValue } from './HierarchyPicker';
import { invalidateScraper, scraperApi } from './api';

const EMPTY: HierarchyValue = { categoryId: null, subcategoryId: null, itemGroupId: null };

interface ParsedSummary {
    fileName: string;
    totalRows: number;
    validRows: Record<string, any>[];
    preview: { name: string; price: string; mrp: string; unit: string; imagesCount: number }[];
}

export function ImportCsvDialog({
    open,
    onOpenChange,
    onImported,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImported: () => void;
}) {
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [parsed, setParsed] = React.useState<ParsedSummary | null>(null);
    const [hierarchy, setHierarchy] = React.useState<HierarchyValue>(EMPTY);
    const [loading, setLoading] = React.useState(false);
    const [dragActive, setDragActive] = React.useState(false);

    React.useEffect(() => {
        if (!open) {
            setParsed(null);
            setHierarchy(EMPTY);
            setDragActive(false);
        }
    }, [open]);

    const handleFile = (file: File | undefined) => {
        if (!file) return;
        if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
            toast.error('Please select a valid .csv file');
            return;
        }

        Papa.parse<Record<string, any>>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: (h) => h.trim(),
            complete: (results) => {
                const rows = results.data.filter((r) => {
                    const name = (r.Name ?? r.name ?? r.Title ?? r.title)?.toString().trim();
                    return Boolean(name);
                });

                if (!rows.length) {
                    toast.error('No valid products found in CSV', {
                        description: 'Make sure your CSV contains a "Name" column.',
                    });
                    return;
                }

                const preview = rows.slice(0, 5).map((r) => {
                    const name = (r.Name ?? r.name ?? r.Title ?? r.title)?.toString().trim() ?? '';
                    const price = (r.Price ?? r.price ?? 0).toString();
                    const mrp = (r.OriginalPrice ?? r.originalPrice ?? r.MRP ?? r.mrp ?? price).toString();
                    const unit = (r.Unit ?? r.unit ?? '1pc').toString();

                    let imagesCount = 0;
                    if (r.Images || r.images) {
                        imagesCount += (r.Images || r.images).toString().split(/[|\n,]/).filter(Boolean).length;
                    }
                    for (let i = 1; i <= 15; i++) {
                        if (r[`ImageURL${i}`] || r[`imageURL${i}`] || r[`imageUrl${i}`]) imagesCount++;
                    }

                    return { name, price, mrp, unit, imagesCount };
                });

                setParsed({
                    fileName: file.name,
                    totalRows: results.data.length,
                    validRows: rows,
                    preview,
                });
            },
            error: (err) => {
                toast.error('Could not read CSV file', { description: err.message });
            },
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!parsed || !parsed.validRows.length) return;

        setLoading(true);
        try {
            const res = await scraperApi.importCsv({
                rows: parsed.validRows,
                categoryId: hierarchy.categoryId ?? undefined,
                subcategoryId: hierarchy.subcategoryId ?? undefined,
                itemGroupId: hierarchy.itemGroupId ?? undefined,
            });

            await invalidateScraper();
            toast.success(`Imported ${res.imported} ${res.imported === 1 ? 'product' : 'products'} into review queue`, {
                description: res.skipped
                    ? `${res.skipped} rows were skipped due to missing names.`
                    : 'All products are now ready for review and publishing.',
            });
            onOpenChange(false);
            onImported();
        } catch (error) {
            toast.error('Failed to import CSV', { description: errorMessage(error) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>Import scraped products (CSV)</DialogTitle>
                        <DialogDescription>
                            Upload an output.csv generated by the scraper. Products will land in &quot;To review&quot; where you can
                            verify details, edit prices/images, and manually publish to the catalogue.
                        </DialogDescription>
                    </DialogHeader>

                    {!parsed ? (
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragActive(true);
                            }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <FileSpreadsheet className="size-6" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Choose output.csv or drag and drop here</p>
                                <p className="text-xs text-muted-foreground mt-1">Supports standard CSV exports from scraper CLI</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="mt-2 pointer-events-none">
                                <Upload aria-hidden className="size-4" /> Select file
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                                <div className="flex items-center gap-2 truncate">
                                    <FileSpreadsheet className="size-4 text-primary shrink-0" />
                                    <span className="font-medium truncate">{parsed.fileName}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        ({parsed.validRows.length} {parsed.validRows.length === 1 ? 'product' : 'products'} found)
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => setParsed(null)}
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Preview of first {parsed.preview.length} products:</Label>
                                <div className="max-h-48 overflow-y-auto rounded-md border text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-muted-foreground sticky top-0 border-b">
                                            <tr>
                                                <th className="px-3 py-1.5 font-medium">Name</th>
                                                <th className="px-3 py-1.5 font-medium">Price</th>
                                                <th className="px-3 py-1.5 font-medium">MRP</th>
                                                <th className="px-3 py-1.5 font-medium">Unit</th>
                                                <th className="px-3 py-1.5 font-medium">Images</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {parsed.preview.map((p, idx) => (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                    <td className="px-3 py-1.5 font-medium truncate max-w-[200px]">{p.name}</td>
                                                    <td className="px-3 py-1.5">₹{p.price}</td>
                                                    <td className="px-3 py-1.5">₹{p.mrp}</td>
                                                    <td className="px-3 py-1.5">{p.unit}</td>
                                                    <td className="px-3 py-1.5">{p.imagesCount} imgs</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Category override (optional)</Label>
                                <HierarchyPicker value={hierarchy} onChange={setHierarchy} />
                                <p className="text-xs text-muted-foreground">
                                    Leave empty to let the auto-categorizer suggest categories based on product names.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!parsed || !parsed.validRows.length || loading}>
                            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload aria-hidden />}
                            {loading ? 'Importing...' : `Import ${parsed?.validRows.length ? `${parsed.validRows.length} ` : ''}for review`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
