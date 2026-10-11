import { Check, Eye, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Access = 'full' | 'view' | 'none';

/** Mirrors the backend role checks (docs/api/admin-api.md, "Roles"). Keep the two in step. */
const MATRIX: { area: string; detail: string; admin: Access; manager: Access }[] = [
    { area: 'Orders', detail: 'Update status, assign riders', admin: 'full', manager: 'full' },
    { area: 'Riders', detail: 'Add, edit, deactivate', admin: 'full', manager: 'full' },
    { area: 'Inventory', detail: 'Stock adjustments, reorder levels', admin: 'full', manager: 'full' },
    { area: 'Customers', detail: 'Profiles and order history', admin: 'full', manager: 'full' },
    { area: 'Analytics', detail: 'Sales and order reports', admin: 'full', manager: 'full' },
    { area: 'Catalogue', detail: 'Products, categories, banners', admin: 'full', manager: 'view' },
    { area: 'Archive and delete', detail: 'Remove products and records', admin: 'full', manager: 'none' },
    { area: 'Store settings', detail: 'Fees, delivery radius, hours', admin: 'full', manager: 'none' },
    { area: 'Team & roles', detail: 'Staff accounts', admin: 'full', manager: 'none' },
    { area: 'Audit log', detail: 'Who changed what', admin: 'full', manager: 'none' },
];

const ACCESS: Record<Access, { label: string; icon: typeof Check; className: string }> = {
    full: { label: 'Full access', icon: Check, className: 'text-success-text' },
    view: { label: 'View only', icon: Eye, className: 'text-muted-foreground' },
    none: { label: 'No access', icon: Minus, className: 'text-muted-foreground/70' },
};

function Cell({ access }: { access: Access }) {
    const { label, icon: Icon, className } = ACCESS[access];
    return (
        <td className="px-3 py-2.5 text-center">
            <span className={cn('inline-flex items-center justify-center', className)} title={label}>
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{label}</span>
                {access === 'view' ? <span className="ml-1 text-xs font-medium">View</span> : null}
            </span>
        </td>
    );
}

export function RoleMatrix({ className }: { className?: string }) {
    return (
        <section aria-labelledby="role-matrix-title" className={cn('min-w-0', className)}>
            <div className="space-y-1 px-4 pt-4 pb-3">
                <h2 id="role-matrix-title" className="text-sm font-semibold text-foreground">
                    What each role can do
                </h2>
                <p className="text-sm text-pretty text-muted-foreground">
                    Managers run the day: orders, riders and stock. Admins also own the catalogue, settings and staff.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                            <th scope="col" className="px-4 py-2 text-left font-medium">
                                Area
                            </th>
                            <th scope="col" className="w-20 px-3 py-2 text-center font-medium">
                                Admin
                            </th>
                            <th scope="col" className="w-20 px-3 py-2 text-center font-medium">
                                Manager
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {MATRIX.map((row) => (
                            <tr key={row.area}>
                                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                                    <span className="block font-medium text-foreground">{row.area}</span>
                                    <span className="block text-xs text-muted-foreground">{row.detail}</span>
                                </th>
                                <Cell access={row.admin} />
                                <Cell access={row.manager} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
