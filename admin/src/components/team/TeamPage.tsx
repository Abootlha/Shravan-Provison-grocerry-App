import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { KeyRound, MoreHorizontal, Pencil, ShieldCheck, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
    DataTable,
    DataTableColumnHeader,
    DateTime,
    EmptyState,
    FormDialog,
    FormSheet,
    PageContainer,
    PageHeader,
    TextField,
    useConfirm,
    withProviders,
} from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { http } from '@/lib/http';
import { queryClient } from '@/lib/query';
import { AdminOnlyNotice, isAdminRole, useStaffUser } from './access';
import { CredentialsDialog, type IssuedCredentials, PasswordField } from './PasswordField';
import { RoleMatrix } from './RoleMatrix';
import { ROLE_LABEL, type StaffMember, type StaffRole, TEAM_KEY } from './types';

const ROLE_HELP: Record<StaffRole, string> = {
    admin: 'Everything, including the catalogue, store settings, staff and the audit log.',
    manager: 'Orders, riders, inventory, customers and analytics. Sees the catalogue but cannot change it.',
};

const USERNAME = /^[A-Za-z0-9._-]{3,50}$/;
const optionalEmail = z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email or leave it empty');

const createSchema = z.object({
    name: z.string().trim().min(2, 'Enter at least 2 characters').max(100, 'Keep it under 100 characters'),
    username: z
        .string()
        .trim()
        .regex(USERNAME, 'Use 3–50 letters, numbers, dots, dashes or underscores'),
    email: optionalEmail,
    role: z.enum(['admin', 'manager']),
    password: z.string().min(12, 'Use at least 12 characters').max(128, 'Keep it under 128 characters'),
});

const editSchema = z.object({
    name: z.string().trim().min(2, 'Enter at least 2 characters').max(100, 'Keep it under 100 characters'),
    email: optionalEmail,
});

const resetSchema = z.object({
    password: z.string().min(12, 'Use at least 12 characters').max(128, 'Keep it under 128 characters'),
});

const invalidateTeam = () => queryClient.invalidateQueries({ queryKey: TEAM_KEY });

function RoleField({ form }: { form: any }) {
    return (
        <Controller
            control={form.control}
            name="role"
            render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid || undefined}>
                    <FieldLegend variant="label">Role</FieldLegend>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                        {(['manager', 'admin'] as const).map((role) => (
                            <FieldLabel
                                key={role}
                                htmlFor={`role-${role}`}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary has-data-checked:bg-brand-tint"
                            >
                                <RadioGroupItem value={role} id={`role-${role}`} className="mt-0.5" />
                                <span className="grid gap-0.5">
                                    <span className="text-sm font-semibold text-foreground">{ROLE_LABEL[role]}</span>
                                    <span className="text-xs text-muted-foreground">{ROLE_HELP[role]}</span>
                                </span>
                            </FieldLabel>
                        ))}
                    </RadioGroup>
                    <FieldError errors={[fieldState.error]} />
                </FieldSet>
            )}
        />
    );
}

function TeamPage() {
    const { user, ready } = useStaffUser();
    const admin = isAdminRole(user);
    const confirm = useConfirm();

    const team = useQuery({
        queryKey: TEAM_KEY,
        queryFn: () => http.get<{ members: StaffMember[] }>('/admin/team'),
        enabled: ready && admin,
        select: (d) => d.members,
    });

    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<StaffMember | null>(null);
    const [resetting, setResetting] = React.useState<StaffMember | null>(null);
    const [issued, setIssued] = React.useState<IssuedCredentials | null>(null);

    const patch = useMutation({
        mutationFn: ({ id, body }: { id: string; body: Partial<StaffMember> & { password?: string } }) =>
            http.patch<{ member: StaffMember }>(`/admin/team/${id}`, body),
        onSuccess: () => invalidateTeam(),
    });

    const changeRole = async (member: StaffMember) => {
        const next: StaffRole = member.role === 'admin' ? 'manager' : 'admin';
        await confirm({
            title: `Make ${member.name} ${next === 'admin' ? 'an admin' : 'a manager'}?`,
            description:
                next === 'admin'
                    ? `${member.name} will be able to change the catalogue, store settings and staff accounts, and read the audit log. They are signed out and get the new access when they sign in again.`
                    : `${member.name} will lose access to catalogue editing, store settings, staff accounts and the audit log. They are signed out on every device now.`,
            confirmLabel: next === 'admin' ? 'Make admin' : 'Make manager',
            onConfirm: async () => {
                await patch.mutateAsync({ id: member._id, body: { role: next } });
                toast.success(`${member.name} is now ${next === 'admin' ? 'an admin' : 'a manager'}`);
            },
        });
    };

    const toggleActive = async (member: StaffMember) => {
        const deactivating = member.isActive;
        await confirm({
            title: deactivating ? `Deactivate ${member.name}?` : `Reactivate ${member.name}?`,
            description: deactivating
                ? `${member.name} is signed out on every device and can't sign in to the admin until reactivated. Their past changes stay in the audit log.`
                : `${member.name} can sign in again as ${member.role === 'admin' ? 'an admin' : 'a manager'} with their existing password.`,
            confirmLabel: deactivating ? 'Deactivate' : 'Reactivate',
            tone: deactivating ? 'destructive' : 'default',
            onConfirm: async () => {
                await patch.mutateAsync({ id: member._id, body: { isActive: !deactivating } });
                toast.success(deactivating ? `${member.name} was deactivated` : `${member.name} can sign in again`);
            },
        });
    };

    const columns = React.useMemo<ColumnDef<StaffMember>[]>(
        () => [
            {
                id: 'member',
                accessorFn: (m) => `${m.name} ${m.username}`,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Member" />,
                meta: { label: 'Member', className: 'min-w-52' },
                enableHiding: false,
                cell: ({ row }) => {
                    const m = row.original;
                    const self = m._id === user?.id;
                    return (
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-foreground">{m.name}</span>
                                {self ? (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                                        You
                                    </Badge>
                                ) : null}
                            </div>
                            <span className="block truncate text-xs text-muted-foreground">@{m.username}</span>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'role',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
                meta: { label: 'Role' },
                cell: ({ row }) => (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                        {row.original.role === 'admin' ? <ShieldCheck className="size-4 text-brand-text" aria-hidden /> : null}
                        {ROLE_LABEL[row.original.role] ?? row.original.role}
                    </span>
                ),
            },
            {
                accessorKey: 'isActive',
                header: 'Status',
                meta: { label: 'Status' },
                cell: ({ row }) =>
                    row.original.isActive ? (
                        <Badge variant="success">Active</Badge>
                    ) : (
                        <Badge variant="neutral">Deactivated</Badge>
                    ),
            },
            {
                accessorKey: 'email',
                header: 'Email',
                meta: { label: 'Email', className: 'max-w-56 truncate text-muted-foreground' },
                cell: ({ row }) => row.original.email || <span className="text-muted-foreground">Not set</span>,
            },
            {
                accessorKey: 'createdAt',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Added" />,
                meta: { label: 'Added', className: 'text-muted-foreground' },
                cell: ({ row }) => <DateTime value={row.original.createdAt} format="date" />,
            },
            {
                id: 'actions',
                enableHiding: false,
                header: () => <span className="sr-only">Actions</span>,
                meta: { align: 'right', className: 'w-12' },
                cell: ({ row }) => {
                    const m = row.original;
                    const self = m._id === user?.id;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                                    <MoreHorizontal aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="truncate">{m.name}</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => setEditing(m)}>
                                    <Pencil aria-hidden />
                                    Edit name and email
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setResetting(m)}>
                                    <KeyRound aria-hidden />
                                    Reset password
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={self} onSelect={() => changeRole(m)}>
                                    <ShieldCheck aria-hidden />
                                    {m.role === 'admin' ? 'Make manager' : 'Make admin'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    disabled={self}
                                    variant={m.isActive ? 'destructive' : 'default'}
                                    onSelect={() => toggleActive(m)}
                                >
                                    {m.isActive ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                                    {m.isActive ? 'Deactivate' : 'Reactivate'}
                                </DropdownMenuItem>
                                {self ? (
                                    <p className="px-1.5 py-1 text-xs text-muted-foreground">
                                        You can't change your own role or deactivate yourself.
                                    </p>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user?.id],
    );

    if (!ready) {
        return (
            <PageContainer>
                <PageHeader title="Team & roles" description="Staff accounts that can sign in to this admin." />
                <Skeleton className="h-64 w-full rounded-xl" />
            </PageContainer>
        );
    }

    if (!admin) {
        return (
            <PageContainer>
                <PageHeader title="Team & roles" description="Staff accounts that can sign in to this admin." />
                <AdminOnlyNotice
                    title="Only admins can manage staff"
                    reason="You're signed in as a manager. Ask an admin to add a colleague, change someone's role or reset a password. Here is what each role can do."
                >
                    <RoleMatrix className="pb-1" />
                </AdminOnlyNotice>
            </PageContainer>
        );
    }

    const activeAdmins = team.data?.filter((m) => m.role === 'admin' && m.isActive).length ?? 0;

    return (
        <PageContainer>
            <PageHeader
                title="Team & roles"
                description="Staff accounts that can sign in to this admin. Riders sign in to the rider app and are managed under Riders."
                actions={
                    <Button onClick={() => setCreating(true)}>
                        <UserPlus aria-hidden />
                        Add staff member
                    </Button>
                }
            />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-2">
                    <DataTable
                        label="Staff accounts"
                        columns={columns}
                        data={team.data}
                        loading={team.isPending}
                        fetching={team.isFetching}
                        error={team.error ?? undefined}
                        onRetry={() => team.refetch()}
                        enableColumnToggle={false}
                        empty={
                            <EmptyState
                                icon={Users}
                                title="No staff accounts"
                                description="Add a manager so someone else can run orders and riders."
                            />
                        }
                    />
                    {team.data && activeAdmins === 1 ? (
                        <p className="px-1 text-xs text-muted-foreground">
                            There is one active admin. The last admin can't be demoted or deactivated, so add a second admin before
                            handing over.
                        </p>
                    ) : null}
                </div>
                <div className="rounded-xl border bg-card">
                    <RoleMatrix className="pb-1" />
                </div>
            </div>

            <FormSheet
                open={creating}
                onOpenChange={setCreating}
                title="Add staff member"
                description="They sign in at this admin with the username and password you set here."
                schema={createSchema}
                defaultValues={{ name: '', username: '', email: '', role: 'manager', password: '' }}
                submitLabel="Create account"
                onSubmit={async (values) => {
                    const { member } = await http.post<{ member: StaffMember }>('/admin/team', {
                        name: values.name,
                        username: values.username,
                        role: values.role,
                        password: values.password,
                        ...(values.email ? { email: values.email } : {}),
                    });
                    await invalidateTeam();
                    toast.success(`${member.name} was added as ${member.role === 'admin' ? 'an admin' : 'a manager'}`);
                    setIssued({
                        title: `${member.name} can sign in now`,
                        description: 'Send these sign-in details to them privately.',
                        username: member.username,
                        password: values.password,
                    });
                }}
            >
                {(form) => (
                    <>
                        <TextField form={form} name="name" label="Display name" autoComplete="off" placeholder="Full name" />
                        <TextField
                            form={form}
                            name="username"
                            label="Username"
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            description="Used to sign in. Letters, numbers, dots, dashes and underscores."
                        />
                        <TextField
                            form={form}
                            name="email"
                            label="Email (optional)"
                            type="email"
                            autoComplete="off"
                            placeholder="name@example.com"
                        />
                        <RoleField form={form} />
                        <PasswordField
                            form={form}
                            name="password"
                            label="Password"
                            description="At least 12 characters. You'll see it once after creating the account."
                        />
                    </>
                )}
            </FormSheet>

            <FormDialog
                open={!!editing}
                onOpenChange={(open) => !open && setEditing(null)}
                title={editing ? `Edit ${editing.name}` : 'Edit member'}
                description={editing ? `Username @${editing.username} can't be changed.` : undefined}
                schema={editSchema}
                defaultValues={{ name: editing?.name ?? '', email: editing?.email ?? '' }}
                submitLabel="Save changes"
                onSubmit={async (values) => {
                    if (!editing) return;
                    await patch.mutateAsync({
                        id: editing._id,
                        body: { name: values.name, ...(values.email ? { email: values.email } : {}) },
                    });
                    toast.success('Changes saved');
                }}
            >
                {(form) => (
                    <>
                        <TextField form={form} name="name" label="Display name" autoComplete="off" />
                        <TextField form={form} name="email" label="Email (optional)" type="email" autoComplete="off" />
                    </>
                )}
            </FormDialog>

            <FormDialog
                open={!!resetting}
                onOpenChange={(open) => !open && setResetting(null)}
                title={resetting ? `Reset ${resetting.name}'s password` : 'Reset password'}
                description="They are signed out on every device and must use the new password."
                schema={resetSchema}
                defaultValues={{ password: '' }}
                submitLabel="Reset password"
                onSubmit={async (values) => {
                    if (!resetting) return;
                    const member = resetting;
                    await patch.mutateAsync({ id: member._id, body: { password: values.password } });
                    toast.success(`${member.name}'s password was reset`);
                    setIssued({
                        title: 'New password set',
                        description: `Send ${member.name} the new password privately.`,
                        username: member.username,
                        password: values.password,
                    });
                }}
            >
                {(form) => <PasswordField form={form} name="password" label="New password" />}
            </FormDialog>

            <CredentialsDialog credentials={issued} onClose={() => setIssued(null)} />
        </PageContainer>
    );
}

export default withProviders(TeamPage);

