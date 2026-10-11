import * as React from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { applyServerError, TextField, useZodForm } from '@/components/shared/forms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, api, SESSION_END_MESSAGES } from '@/lib/api';
import { saveSession } from '@/lib/session';
import { Controller } from 'react-hook-form';

const schema = z.object({
    username: z.string().trim().min(1, 'Enter your username'),
    password: z.string().min(1, 'Enter your password'),
});

function readReason() {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (!reason) return null;
    window.history.replaceState(null, '', window.location.pathname);
    return SESSION_END_MESSAGES[reason] ?? SESSION_END_MESSAGES.SESSION_EXPIRED;
}

export default function LoginForm() {
    const form = useZodForm(schema, { username: '', password: '' });
    const [notice, setNotice] = React.useState<string | null>(null);
    const [showPassword, setShowPassword] = React.useState(false);

    React.useEffect(() => {
        setNotice(readReason());
    }, []);

    const onSubmit = form.handleSubmit(async (values) => {
        setNotice(null);
        try {
            const data = await api.login(values.username, values.password);
            if (!data?.accessToken) throw new Error('The server did not return a session. Please retry.');
            saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
            window.location.replace('/');
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                const disabled = /disabled/i.test(error.message);
                form.setError('root.server', {
                    type: 'server',
                    message: disabled ? 'This account is disabled. Ask an admin to re-enable it.' : 'Wrong username or password.',
                });
                return;
            }
            applyServerError(form, error);
        }
    });

    const rootError = (form.formState.errors.root as { server?: { message?: string } } | undefined)?.server?.message;
    const submitting = form.formState.isSubmitting;

    return (
        <Card className="w-full gap-6 py-6 shadow-none">
            <CardHeader className="px-6">
                <CardTitle className="text-xl font-bold tracking-tight">Sign in</CardTitle>
                <CardDescription>Use the staff account your store admin gave you.</CardDescription>
            </CardHeader>
            <CardContent className="px-6">
                <form onSubmit={onSubmit} noValidate>
                    <FieldGroup className="gap-5">
                        {notice ? (
                            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                                {notice}
                            </p>
                        ) : null}
                        <TextField
                            form={form}
                            name="username"
                            label="Username"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            autoFocus
                        />
                        <Controller
                            control={form.control}
                            name="password"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid || undefined}>
                                    <FieldLabel htmlFor="password-field">Password</FieldLabel>
                                    <div className="relative">
                                        <Input
                                            {...field}
                                            id="password-field"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            className="pr-10"
                                            aria-invalid={fieldState.invalid || undefined}
                                            aria-describedby="password-field-help"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="absolute top-0.5 right-0.5 text-muted-foreground"
                                            onClick={() => setShowPassword((v) => !v)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            aria-pressed={showPassword}
                                        >
                                            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                                        </Button>
                                    </div>
                                    <div id="password-field-help" className="contents">
                                        <FieldError errors={[fieldState.error]} />
                                    </div>
                                </Field>
                            )}
                        />
                        {rootError ? (
                            <p role="alert" className="rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive">
                                {rootError}
                            </p>
                        ) : null}
                        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
