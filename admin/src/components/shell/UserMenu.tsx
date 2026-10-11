import * as React from 'react';
import { ChevronsUpDown, LogOut, Monitor, Moon, Store, Sun } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { getAdminUser, type AdminUser } from '@/lib/session';
import type { ThemePreference } from '@/lib/theme';

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
};

export function roleLabel(role: string) {
    return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function initials(user: AdminUser) {
    const source = user.name || user.username || '';
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Reads the stored session user after hydration (localStorage is not available at build time). */
export function useAdminUser() {
    const [user, setUser] = React.useState<AdminUser | null>(null);
    React.useEffect(() => {
        setUser(getAdminUser());
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === 'adminUser') setUser(getAdminUser());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    return user;
}

export function UserMenu() {
    const user = useAdminUser();
    const { isMobile } = useSidebar();
    const { preference, setPreference } = useTheme();
    const [signingOut, setSigningOut] = React.useState(false);

    const displayName = user?.name || user?.username || 'Signed in';

    const signOut = async () => {
        setSigningOut(true);
        await api.logout();
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            aria-label={`Account: ${displayName}`}
                        >
                            <Avatar className="size-8 rounded-lg">
                                <AvatarFallback className="rounded-lg bg-brand-tint text-xs font-semibold text-brand-text">
                                    {user ? initials(user) : ''}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                                {user ? (
                                    <>
                                        <span className="truncate font-semibold text-sidebar-accent-foreground">{displayName}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {roleLabel(user.role)}
                                            {user.username && user.name ? ` · @${user.username}` : ''}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="block h-3.5 w-24 rounded bg-sidebar-accent" aria-hidden />
                                        <span className="mt-1 block h-3 w-16 rounded bg-sidebar-accent" aria-hidden />
                                    </>
                                )}
                            </div>
                            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
                        side={isMobile ? 'bottom' : 'right'}
                        align="end"
                        sideOffset={6}
                    >
                        <DropdownMenuLabel className="font-normal">
                            <div className="grid text-sm leading-tight">
                                <span className="truncate font-semibold text-foreground">{displayName}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {user ? roleLabel(user.role) : ''}
                                    {user?.username ? ` · @${user.username}` : ''}
                                </span>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <a href="/settings">
                                    <Store aria-hidden />
                                    Store settings
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    {preference === 'dark' ? <Moon aria-hidden /> : preference === 'light' ? <Sun aria-hidden /> : <Monitor aria-hidden />}
                                    Theme
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup
                                        value={preference}
                                        onValueChange={(v) => setPreference(v as ThemePreference)}
                                    >
                                        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                void signOut();
                            }}
                            disabled={signingOut}
                        >
                            <LogOut aria-hidden />
                            {signingOut ? 'Signing out…' : 'Log out'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
