import * as React from 'react';
import { Search, ShoppingBasket } from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmHost } from '@/components/shared/confirm';
import { Providers } from '@/components/shared/Providers';
import { CommandMenu } from './CommandMenu';
import { openCommandPalette } from './command-registry';
import { findNavLocation, isNavItemActive, NAV_GROUPS } from './nav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export interface Crumb {
    label: string;
    href?: string;
}

export interface AppShellProps {
    /** Page title; the last breadcrumb. */
    title: string;
    /** Build-time pathname from Astro, used until the client location is known. */
    pathname: string;
    /** Overrides the breadcrumbs derived from the navigation. The last crumb is the current page. */
    breadcrumbs?: Crumb[];
    children?: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'admin-sidebar';

/** Keeps a failing overlay (palette, dialogs, toasts) from taking the whole page down with it. */
class OverlayBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(error: unknown) {
        console.error('Shell overlay failed', error);
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

function subscribeLocation(callback: () => void) {
    window.addEventListener('popstate', callback);
    return () => window.removeEventListener('popstate', callback);
}

/** Pathname + search. The server snapshot is the build-time pathname (static builds have no query). */
function useLocation(serverPathname: string) {
    const href = React.useSyncExternalStore(
        subscribeLocation,
        () => window.location.pathname + window.location.search,
        () => serverPathname,
    );
    const [pathname, search = ''] = href.split('?');
    return { pathname, search: search ? `?${search}` : '' };
}

function usePersistedSidebar() {
    const [open, setOpen] = React.useState(true);
    React.useLayoutEffect(() => {
        try {
            if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed') setOpen(false);
        } catch {
            // Storage blocked: stay expanded.
        }
    }, []);
    const update = React.useCallback((next: boolean) => {
        setOpen(next);
        try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'expanded' : 'collapsed');
        } catch {
            // Ignore; the state still applies to this page view.
        }
    }, []);
    return [open, update] as const;
}

function Brand() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild tooltip="Shravan Kirana">
                    <a href="/">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <ShoppingBasket className="size-4.5" aria-hidden />
                        </span>
                        <span className="grid min-w-0 flex-1 text-left leading-tight">
                            <span className="truncate text-sm font-bold tracking-tight text-sidebar-accent-foreground">
                                Shravan Kirana
                            </span>
                            <span className="truncate text-xs text-muted-foreground">Store admin</span>
                        </span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function Navigation({ pathname, search }: { pathname: string; search: string }) {
    const { isMobile, setOpenMobile } = useSidebar();
    return (
        <nav aria-label="Main">
            {NAV_GROUPS.map((group) => (
                <SidebarGroup key={group.label} className="py-1">
                    <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                const active = isNavItemActive(item.href, pathname, search);
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active}
                                            tooltip={item.title}
                                            className="data-[active=true]:bg-brand-tint data-[active=true]:font-semibold data-[active=true]:text-brand-text [&[data-active=true]>svg]:text-brand-text"
                                        >
                                            <a
                                                href={item.href}
                                                aria-current={active ? 'page' : undefined}
                                                onClick={() => isMobile && setOpenMobile(false)}
                                            >
                                                <item.icon aria-hidden />
                                                <span>{item.title}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
        </nav>
    );
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Resolved after hydration. */
function useModifierLabel() {
    const [label, setLabel] = React.useState('Ctrl');
    React.useEffect(() => {
        if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setLabel('⌘');
    }, []);
    return label;
}

function SearchButton() {
    const mod = useModifierLabel();
    return (
        <>
            <Button
                variant="outline"
                onClick={openCommandPalette}
                className="hidden h-9 w-56 justify-start gap-2 rounded-lg bg-card px-3 font-normal text-muted-foreground shadow-none hover:text-foreground md:flex lg:w-72"
                aria-label="Search pages and actions"
                aria-keyshortcuts="Control+K Meta+K"
            >
                <Search aria-hidden />
                <span className="flex-1 text-left">Search or jump to…</span>
                <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-sans text-[11px] font-medium text-muted-foreground lg:inline-block">
                    {mod} K
                </kbd>
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={openCommandPalette}
                className="md:hidden"
                aria-label="Search pages and actions"
            >
                <Search aria-hidden />
            </Button>
        </>
    );
}

function Header({ crumbs }: { crumbs: Crumb[] }) {
    const { state, isMobile } = useSidebar();
    const current = crumbs[crumbs.length - 1];
    const parents = crumbs.slice(0, -1);
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
            <Tooltip>
                <TooltipTrigger asChild>
                    <SidebarTrigger className="size-9" aria-label={isMobile ? 'Open navigation' : state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'} />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    {isMobile ? 'Menu' : state === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
                    <kbd className="ml-2 font-sans text-[11px] opacity-70">Ctrl B</kbd>
                </TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
            <Breadcrumb className="min-w-0 flex-1">
                <BreadcrumbList className="flex-nowrap">
                    {parents.map((crumb) => (
                        <React.Fragment key={crumb.label}>
                            <BreadcrumbItem className="hidden sm:inline-flex">
                                {crumb.href ? <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink> : <span>{crumb.label}</span>}
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden sm:inline-flex" />
                        </React.Fragment>
                    ))}
                    {current ? (
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="truncate font-semibold">{current.label}</BreadcrumbPage>
                        </BreadcrumbItem>
                    ) : null}
                </BreadcrumbList>
            </Breadcrumb>
            <div className="flex items-center gap-1">
                <SearchButton />
                <ThemeToggle />
            </div>
        </header>
    );
}

function ShellInner({ title, pathname: serverPathname, breadcrumbs, children }: AppShellProps) {
    const { pathname, search } = useLocation(serverPathname);
    const [open, setOpen] = usePersistedSidebar();

    const crumbs = React.useMemo<Crumb[]>(() => {
        if (breadcrumbs?.length) return breadcrumbs;
        const location = findNavLocation(pathname, search);
        if (!location) return [{ label: title }];
        return [{ label: location.group.label }, { label: location.item.title }];
    }, [breadcrumbs, pathname, search, title]);

    return (
        <SidebarProvider open={open} onOpenChange={setOpen}>
            <Sidebar collapsible="icon">
                <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
                    <Brand />
                </SidebarHeader>
                <SidebarContent className="py-2">
                    <Navigation pathname={pathname} search={search} />
                </SidebarContent>
                <SidebarFooter className="border-t border-sidebar-border">
                    <UserMenu />
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            <SidebarInset className="min-w-0">
                <Header crumbs={crumbs} />
                <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
                    {children}
                </main>
            </SidebarInset>
            <OverlayBoundary>
                <CommandMenu />
            </OverlayBoundary>
            <OverlayBoundary>
                <ConfirmHost />
            </OverlayBoundary>
            <Toaster position="bottom-right" />
        </SidebarProvider>
    );
}

/** The admin frame: sidebar, header, command palette, toasts and confirm dialogs. */
export default function AppShell(props: AppShellProps) {
    return (
        <Providers>
            <ShellInner {...props} />
        </Providers>
    );
}
