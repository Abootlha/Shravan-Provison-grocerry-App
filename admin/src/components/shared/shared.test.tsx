import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { ConfirmHost, confirm } from './confirm';
import { DataTable } from './DataTable';
import { EmptyState } from './EmptyState';
import { FormDialog, TextField } from './forms';
import { StatCard } from './StatCard';
import { StatusBadge, stockStatus } from './StatusBadge';

beforeAll(() => {
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return [];
            }
        },
    );
    vi.stubGlobal(
        'matchMedia',
        (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    );
    window.matchMedia = globalThis.matchMedia;
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.hasPointerCapture = () => false;
});

type Row = { _id: string; name: string; qty: number };
const columns: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'qty', header: 'Qty', meta: { align: 'right' } },
];

describe('DataTable', () => {
    it('renders rows and the range summary', () => {
        render(<DataTable label="Products" columns={columns} data={[{ _id: '1', name: 'Atta 5kg', qty: 4 }]} />);
        expect(screen.getByRole('table', { name: 'Products' })).toBeInTheDocument();
        expect(screen.getByText('Atta 5kg')).toBeInTheDocument();
        expect(screen.getByText(/1–1 of 1/)).toBeInTheDocument();
    });

    it('shows the empty slot and an error with retry', async () => {
        const { rerender } = render(
            <DataTable label="Products" columns={columns} data={[]} empty={<EmptyState title="No products yet" />} />,
        );
        expect(screen.getByText('No products yet')).toBeInTheDocument();
        const retry = vi.fn();
        rerender(<DataTable label="Products" columns={columns} data={undefined} error={new Error('Boom')} onRetry={retry} />);
        await userEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(retry).toHaveBeenCalled();
    });
});

describe('StatCard and StatusBadge', () => {
    it('never invents a value and only shows a delta when given', () => {
        render(<StatCard label="Revenue today" value={null} format="money" />);
        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.queryByText(/vs/)).toBeNull();
    });

    it('labels statuses and derives stock levels from one threshold', () => {
        render(<StatusBadge kind="order" status="OUT_FOR_DELIVERY" />);
        expect(screen.getByText('Out for delivery')).toBeInTheDocument();
        expect(stockStatus(0)).toBe('out');
        expect(stockStatus(10)).toBe('low');
        expect(stockStatus(11)).toBe('in_stock');
    });
});

describe('FormDialog', () => {
    it('validates inline and submits parsed values', async () => {
        const onSubmit = vi.fn();
        const schema = z.object({ name: z.string().trim().min(2, 'Enter at least 2 characters') });
        render(
            <FormDialog open onOpenChange={() => {}} title="New category" schema={schema} defaultValues={{ name: '' }} onSubmit={onSubmit} submitLabel="Create">
                {(form) => <TextField form={form} name="name" label="Name" />}
            </FormDialog>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(await screen.findByText('Enter at least 2 characters')).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('Name'), '  Dairy ');
        await userEvent.click(screen.getByRole('button', { name: 'Create' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalled());
        expect(onSubmit.mock.calls[0][0]).toEqual({ name: 'Dairy' });
    });
});

describe('confirm()', () => {
    it('resolves true when confirmed', async () => {
        render(<ConfirmHost />);
        let result: Promise<boolean> | undefined;
        act(() => {
            result = confirm({ title: 'Delete product?', confirmLabel: 'Delete product', tone: 'destructive' });
        });
        await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }));
        await expect(result).resolves.toBe(true);
    });
});
