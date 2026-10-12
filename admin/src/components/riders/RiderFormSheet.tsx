import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormSheet, SelectField, TextField } from '@/components/shared';
import { http } from '@/lib/http';
import { CredentialsDialog, type IssuedCredentials, PasswordField } from '@/components/team/PasswordField';
import { invalidateRiders, localPhone, type Rider, VEHICLE_TYPES } from './types';

const name = z.string().trim().min(2, 'Enter at least 2 characters').max(100, 'Keep it under 100 characters');
const phone = z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'));
const vehicleType = z.enum(VEHICLE_TYPES, { message: 'Choose a vehicle' });

const createSchema = z.object({
    name,
    username: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9._-]{3,50}$/, 'Use 3–50 letters, numbers, dots, dashes or underscores'),
    phone,
    vehicleType,
    // The rider app accepts 6–20 characters; ask for 8 so generated and typed passwords are sturdier.
    password: z.string().min(8, 'Use at least 8 characters').max(20, 'Keep it to 20 characters or fewer'),
});

const editSchema = z.object({ name, phone, vehicleType });

const VEHICLE_OPTIONS = VEHICLE_TYPES.map((v) => ({ value: v, label: v }));

export function RiderFormSheet({
    open,
    onOpenChange,
    rider,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Edit this rider; omit to create one. */
    rider?: Rider | null;
}) {
    const [issued, setIssued] = React.useState<IssuedCredentials | null>(null);

    return (
        <>
            {rider ? (
                <FormSheet
                    open={open}
                    onOpenChange={onOpenChange}
                    title={`Edit ${rider.name}`}
                    description={`Username @${rider.username} can't be changed. The rider can always sign in with an OTP to their mobile number.`}
                    schema={editSchema}
                    defaultValues={{ name: rider.name, phone: localPhone(rider.phone), vehicleType: rider.vehicleType }}
                    submitLabel="Save changes"
                    onSubmit={async (values) => {
                        await http.patch(`/admin/riders/${rider._id}`, values);
                        await invalidateRiders();
                        toast.success('Rider updated');
                    }}
                >
                    {(form) => (
                        <>
                            <TextField form={form} name="name" label="Full name" autoComplete="off" />
                            <TextField
                                form={form}
                                name="phone"
                                label="Mobile number"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="off"
                                description="Used for OTP sign-in and shown to customers during delivery."
                            />
                            <SelectField form={form} name="vehicleType" label="Vehicle" options={VEHICLE_OPTIONS} />
                        </>
                    )}
                </FormSheet>
            ) : (
                <FormSheet
                    open={open}
                    onOpenChange={onOpenChange}
                    title="Add rider"
                    description="The rider signs in to the rider app with this username and password, or with an OTP to their phone."
                    schema={createSchema}
                    defaultValues={{ name: '', username: '', phone: '', vehicleType: 'Two Wheeler', password: '' }}
                    submitLabel="Add rider"
                    onSubmit={async (values) => {
                        const { rider: created } = await http.post<{ rider: Rider }>('/riders', values);
                        await invalidateRiders();
                        toast.success(`${created.name} was added`, { description: 'They show as offline until they start a shift.' });
                        setIssued({
                            title: `${created.name} can sign in now`,
                            description: 'Share these rider app sign-in details with them privately.',
                            username: created.username,
                            password: values.password,
                        });
                    }}
                >
                    {(form) => (
                        <>
                            <TextField form={form} name="name" label="Full name" autoComplete="off" />
                            <TextField
                                form={form}
                                name="phone"
                                label="Mobile number"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="10-digit mobile"
                                description="Used for OTP sign-in and shown to customers during delivery."
                            />
                            <TextField
                                form={form}
                                name="username"
                                label="Username"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                            />
                            <SelectField form={form} name="vehicleType" label="Vehicle" options={VEHICLE_OPTIONS} />
                            <PasswordField
                                form={form}
                                name="password"
                                label="Password"
                                minLength={8}
                                description="8–20 characters. You'll see it once after adding the rider."
                            />
                        </>
                    )}
                </FormSheet>
            )}
            <CredentialsDialog credentials={issued} onClose={() => setIssued(null)} />
        </>
    );
}
