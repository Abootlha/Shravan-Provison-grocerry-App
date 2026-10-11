import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AdminUser, getAdminUser } from '@/lib/session';

/**
 * The signed-in staff member. `ready` is false during the server render and the first client
 * render (localStorage is only readable after hydration), so pages can show a skeleton
 * instead of flashing the wrong state.
 */
export function useStaffUser(): { user: AdminUser | null; ready: boolean } {
    const [state, setState] = React.useState<{ user: AdminUser | null; ready: boolean }>({ user: null, ready: false });
    React.useEffect(() => {
        setState({ user: getAdminUser(), ready: true });
    }, []);
    return state;
}

export const isAdminRole = (user: AdminUser | null | undefined) => user?.role === 'admin';

/** Shown to managers on admin-only pages: what the page is, why they can't use it, who can. */
export function AdminOnlyNotice({ title, reason, children }: { title: string; reason: string; children?: React.ReactNode }) {
    return (
        <div className="max-w-3xl rounded-xl border bg-card">
            <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:gap-4 sm:p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <ShieldAlert className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1.5">
                    <h2 className="text-base font-semibold text-foreground">{title}</h2>
                    <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground">{reason}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                        <Button asChild variant="outline" size="sm">
                            <a href="/">Back to dashboard</a>
                        </Button>
                    </div>
                </div>
            </div>
            {children ? <div className="border-t">{children}</div> : null}
        </div>
    );
}
