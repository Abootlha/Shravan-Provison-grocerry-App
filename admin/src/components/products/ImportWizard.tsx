import * as React from 'react';
import Papa from 'papaparse';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { confirm } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage, http } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import {
    autoMapColumns,
    buildTemplateCsv,
    IMPORT_CONCURRENCY,
    IMPORT_FIELDS,
    MAX_IMPORT_FILE_BYTES,
    MAX_IMPORT_ROWS,
    runWithConcurrency,
    validateImportRows,
    type CatalogLookups,
    type ColumnMapping,
    type ImportRow,
} from '@/lib/productCsv';
import { cn } from '@/lib/utils';
import { invalidateProducts, useCategories, useItemGroups, useSubcategories } from './data';
import { refId } from './types';

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done';

interface Parsed {
    fileName: string;
    headers: string[];
    rows: Record<string, unknown>[];
}

interface Outcome {
    row: number;
    name: string;
    ok: boolean;
    message?: string;
}

const UNMAPPED = '__skip__';
const STEPS: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map', label: 'Match columns' },
    { id: 'preview', label: 'Check rows' },
    { id: 'importing', label: 'Import' },
];

export function ImportWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [step, setStep] = React.useState<Step>('upload');
    const [parsed, setParsed] = React.useState<Parsed | null>(null);
    const [mapping, setMapping] = React.useState<ColumnMapping>({});
    const [fileError, setFileError] = React.useState<string | null>(null);
    const [outcomes, setOutcomes] = React.useState<Outcome[]>([]);
    const [showOnly, setShowOnly] = React.useState<'all' | 'errors'>('all');
    const abortRef = React.useRef<AbortController | null>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);

    const categories = useCategories();
    const subcategories = useSubcategories();
    const itemGroups = useItemGroups();
    const catalogReady = !!(categories.data && subcategories.data && itemGroups.data);
    const catalogError = categories.error ?? subcategories.error ?? itemGroups.error;

    const catalog = React.useMemo<CatalogLookups | null>(() => {
        if (!catalogReady) return null;
        return {
            categories: categories.data!.map((c) => ({ _id: c._id, name: c.name })),
            subcategories: subcategories.data!.map((s) => ({ _id: s._id, name: s.name, parentId: refId(s.parentId) })),
            itemGroups: itemGroups.data!.map((g) => ({ _id: g._id, name: g.name, subcategoryId: refId(g.subcategoryId) })),
        };
    }, [catalogReady, categories.data, subcategories.data, itemGroups.data]);

    const results = React.useMemo<ImportRow[]>(() => (parsed && catalog ? validateImportRows(parsed.rows, mapping, catalog) : []), [parsed, mapping, catalog]);
    const valid = results.filter((r) => r.data);
    const invalid = results.filter((r) => !r.data);
    const drafts = valid.filter((r) => r.status === 'draft').length;
    const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);

    const reset = () => {
        setStep('upload');
        setParsed(null);
        setMapping({});
        setFileError(null);
        setOutcomes([]);
        setShowOnly('all');
    };

    React.useEffect(() => {
        if (open) reset();
    }, [open]);

    const close = async () => {
        if (step === 'importing') {
            const stop = await confirm({
                title: 'Stop the import?',
                description: 'Rows already sent stay imported. The rest are skipped.',
                confirmLabel: 'Stop import',
                cancelLabel: 'Keep importing',
                tone: 'destructive',
            });
            if (stop) abortRef.current?.abort();
            return;
        }
        onOpenChange(false);
    };

    const readFile = (file: File | undefined) => {
        setFileError(null);
        if (!file) return;
        if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return setFileError('Choose a .csv file. In Excel or Sheets use File › Download › CSV.');
        if (file.size > MAX_IMPORT_FILE_BYTES) return setFileError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB. Split it into smaller files.`);
        Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: (h) => h.trim(),
            complete: (res) => {
                const headers = (res.meta.fields ?? []).filter(Boolean);
                if (!headers.length || !res.data.length) return setFileError('No rows found. The first line must be the column names.');
                if (res.data.length > MAX_IMPORT_ROWS) return setFileError(`This file has ${formatNumber(res.data.length)} rows; import at most ${formatNumber(MAX_IMPORT_ROWS)} at a time.`);
                setParsed({ fileName: file.name, headers, rows: res.data });
                setMapping(autoMapColumns(headers));
                setStep('map');
            },
            error: (err) => setFileError(`Couldn't read the file: ${err.message}`),
        });
    };

    const downloadTemplate = () => {
        const cat = categories.data?.find((c) => c.isActive !== false);
        const sub = subcategories.data?.find((s) => refId(s.parentId) === cat?._id);
        const blob = new Blob([buildTemplateCsv(cat?.name, sub?.name)], { type: 'text/csv;charset=utf-8' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = 'products-import-template.csv';
        a.click();
        URL.revokeObjectURL(href);
    };

    const runImport = async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        setOutcomes([]);
        setStep('importing');
        const collected: Outcome[] = [];
        await runWithConcurrency(
            valid,
            IMPORT_CONCURRENCY,
            async (row) => {
                try {
                    await http.post('/products', row.data);
                    collected.push({ row: row.row, name: row.name, ok: true });
                } catch (error) {
                    collected.push({ row: row.row, name: row.name, ok: false, message: errorMessage(error) });
                }
                setOutcomes([...collected]);
            },
            controller.signal,
        );
        invalidateProducts();
        setStep('done');
        const ok = collected.filter((o) => o.ok).length;
        if (ok) toast.success(`${formatNumber(ok)} product${ok === 1 ? '' : 's'} imported`);
    };

    const done = outcomes.length;
    const succeeded = outcomes.filter((o) => o.ok);
    const failed = outcomes.filter((o) => !o.ok);
    const stepIndex = STEPS.findIndex((s) => s.id === (step === 'done' ? 'importing' : step));
    const shownRows = showOnly === 'errors' ? results.filter((r) => !r.data || r.warnings.length) : results;

    return (
        <Dialog open={open} onOpenChange={(o) => (!o ? close() : onOpenChange(o))}>
            <DialogContent className="flex max-h-[min(90dvh,760px)] flex-col gap-0 p-0 sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader className="border-b px-5 pt-5 pb-4">
                    <DialogTitle>Import products from CSV</DialogTitle>
                    <DialogDescription>Rows are checked against your categories before anything is created.</DialogDescription>
                    <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Import steps">
                        {STEPS.map((s, i) => (
                            <li key={s.id} aria-current={i === stepIndex ? 'step' : undefined} className={cn('flex items-center gap-1.5', i === stepIndex ? 'font-semibold text-foreground' : i < stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
                                <span
                                    className={cn(
                                        'flex size-5 items-center justify-center rounded-md text-[11px] tabular-nums',
                                        i === stepIndex ? 'bg-primary text-primary-foreground' : i < stepIndex ? 'bg-brand-tint text-brand-text' : 'bg-muted',
                                    )}
                                >
                                    {i + 1}
                                </span>
                                {s.label}
                            </li>
                        ))}
                    </ol>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {step === 'upload' ? (
                        <div className="grid gap-4">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    readFile(e.dataTransfer.files?.[0]);
                                }}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                                    dragging ? 'border-ring bg-brand-tint' : 'bg-muted/40 hover:border-ring',
                                )}
                            >
                                <Upload className="size-6 text-muted-foreground" aria-hidden />
                                <span className="text-sm font-semibold">Drop a CSV here or choose a file</span>
                                <span className="text-sm text-muted-foreground">Up to {formatNumber(MAX_IMPORT_ROWS)} rows, 2 MB</span>
                            </button>
                            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => readFile(e.target.files?.[0])} />
                            {fileError ? (
                                <p role="alert" className="rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive">
                                    {fileError}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                    <p className="text-sm text-pretty">
                                        <span className="font-medium">Start from the template.</span>{' '}
                                        <span className="text-muted-foreground">Category, subcategory and item group are matched by name.</span>
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                    <Download aria-hidden /> Template
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {step === 'map' && parsed ? (
                        <div className="grid gap-4">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{parsed.fileName}</span> · {formatNumber(parsed.rows.length)} rows. Match each field to a column in your file.
                            </p>
                            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                                {IMPORT_FIELDS.map((f) => (
                                    <li key={f.key} className="grid gap-1">
                                        <label htmlFor={`map-${f.key}`} className="text-sm font-medium">
                                            {f.label}
                                            {f.required ? <span className="text-destructive"> *</span> : null}
                                        </label>
                                        <Select value={mapping[f.key] ?? UNMAPPED} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === UNMAPPED ? undefined : v }))}>
                                            <SelectTrigger id={`map-${f.key}`} className="w-full" aria-invalid={(f.required && !mapping[f.key]) || undefined}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={UNMAPPED}>{f.required ? 'Choose a column' : 'Not in file'}</SelectItem>
                                                {parsed.headers.map((h) => (
                                                    <SelectItem key={h} value={h}>
                                                        {h}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {f.hint ? <span className="text-xs text-muted-foreground">{f.hint}</span> : null}
                                    </li>
                                ))}
                            </ul>
                            {catalogError ? <p className="text-sm text-destructive">Couldn’t load categories to check rows: {errorMessage(catalogError)}</p> : null}
                        </div>
                    ) : null}

                    {step === 'preview' ? (
                        <div className="grid gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="success" className="h-6">
                                    <CheckCircle2 aria-hidden /> {formatNumber(valid.length)} ready
                                </Badge>
                                {invalid.length ? (
                                    <Badge variant="destructive" className="h-6">
                                        <XCircle aria-hidden /> {formatNumber(invalid.length)} with errors
                                    </Badge>
                                ) : null}
                                {drafts ? (
                                    <Badge variant="warning" className="h-6">
                                        {formatNumber(drafts)} as drafts
                                    </Badge>
                                ) : null}
                                <div className="ml-auto">
                                    <Select value={showOnly} onValueChange={(v) => setShowOnly(v as 'all' | 'errors')}>
                                        <SelectTrigger size="sm" aria-label="Rows to show">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            <SelectItem value="all">All rows</SelectItem>
                                            <SelectItem value="errors">Problems only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {invalid.length ? (
                                <p className="text-sm text-muted-foreground">Rows with errors are skipped. Fix them in the file and import it again; rows already imported would be created twice, so remove those first.</p>
                            ) : null}
                            <div className="overflow-x-auto rounded-xl border">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                                        <tr className="border-b">
                                            <th className="w-12 px-3 py-2 text-right font-medium">Row</th>
                                            <th className="px-3 py-2 text-left font-medium">Product</th>
                                            <th className="px-3 py-2 text-left font-medium">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shownRows.slice(0, 300).map((r) => (
                                            <tr key={r.row} className="border-b align-top last:border-0">
                                                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{r.row}</td>
                                                <td className="max-w-[14rem] px-3 py-2">
                                                    <span className="line-clamp-2 font-medium break-words">{r.name}</span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {r.errors.length ? (
                                                        <ul className="grid gap-0.5 text-destructive">
                                                            {r.errors.map((e) => (
                                                                <li key={e} className="break-words">{e}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-success-text">{r.status === 'draft' ? 'Ready · draft' : 'Ready · active'}</span>
                                                    )}
                                                    {r.warnings.length && !r.errors.length ? (
                                                        <ul className="mt-0.5 grid gap-0.5 text-warning">
                                                            {r.warnings.map((w) => (
                                                                <li key={w} className="flex gap-1 break-words">
                                                                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                                                                    {w}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {shownRows.length > 300 ? <p className="border-t px-3 py-2 text-xs text-muted-foreground">Showing the first 300 of {formatNumber(shownRows.length)} rows.</p> : null}
                                {shownRows.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No problems found.</p> : null}
                            </div>
                        </div>
                    ) : null}

                    {step === 'importing' || step === 'done' ? (
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between text-sm tabular-nums">
                                    <span className="font-medium">
                                        {step === 'done' ? (abortRef.current?.signal.aborted ? 'Import stopped' : 'Import finished') : 'Importing…'}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {formatNumber(done)} of {formatNumber(valid.length)}
                                    </span>
                                </div>
                                <Progress value={valid.length ? (done / valid.length) * 100 : 0} aria-label="Import progress" />
                            </div>
                            <dl className="grid grid-cols-3 gap-3 text-sm">
                                <div className="rounded-xl border p-3">
                                    <dt className="text-muted-foreground">Created</dt>
                                    <dd className="text-lg font-semibold text-success-text tabular-nums">{formatNumber(succeeded.length)}</dd>
                                </div>
                                <div className="rounded-xl border p-3">
                                    <dt className="text-muted-foreground">Failed</dt>
                                    <dd className={cn('text-lg font-semibold tabular-nums', failed.length && 'text-destructive')}>{formatNumber(failed.length)}</dd>
                                </div>
                                <div className="rounded-xl border p-3">
                                    <dt className="text-muted-foreground">Skipped</dt>
                                    <dd className="text-lg font-semibold tabular-nums">{formatNumber(invalid.length + (step === 'done' ? valid.length - done : 0))}</dd>
                                </div>
                            </dl>
                            {failed.length ? (
                                <div className="rounded-xl border">
                                    <p className="border-b px-3 py-2 text-sm font-medium">Rejected by the server</p>
                                    <ul className="max-h-56 divide-y overflow-y-auto text-sm">
                                        {failed
                                            .sort((a, b) => a.row - b.row)
                                            .map((f) => (
                                                <li key={f.row} className="grid grid-cols-[3rem_1fr] gap-2 px-3 py-2">
                                                    <span className="text-right text-muted-foreground tabular-nums">{f.row}</span>
                                                    <span className="min-w-0 break-words">
                                                        <span className="font-medium">{f.name}</span> · <span className="text-destructive">{f.message}</span>
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="border-t px-5 py-3">
                    {step === 'map' ? (
                        <>
                            <Button variant="ghost" onClick={reset}>
                                Choose another file
                            </Button>
                            <Button onClick={() => setStep('preview')} disabled={missingRequired.length > 0 || !catalogReady}>
                                {!catalogReady && !catalogError ? <Loader2 className="animate-spin" aria-hidden /> : null}
                                {missingRequired.length ? `Match ${missingRequired.map((f) => f.label).join(', ')}` : 'Check rows'}
                            </Button>
                        </>
                    ) : step === 'preview' ? (
                        <>
                            <Button variant="ghost" onClick={() => setStep('map')}>
                                Back
                            </Button>
                            <Button onClick={runImport} disabled={valid.length === 0}>
                                Import {formatNumber(valid.length)} product{valid.length === 1 ? '' : 's'}
                            </Button>
                        </>
                    ) : step === 'importing' ? (
                        <Button variant="outline" onClick={close}>
                            Stop
                        </Button>
                    ) : step === 'done' ? (
                        <>
                            <Button variant="ghost" onClick={reset}>
                                Import another file
                            </Button>
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
