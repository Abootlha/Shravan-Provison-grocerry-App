import {
    BarChart3,
    Bike,
    Boxes,
    CircleCheck,
    FolderTree,
    GalleryHorizontalEnd,
    History,
    Layers,
    LayoutDashboard,
    type LucideIcon,
    Package,
    Radio,
    Store,
    Tags,
    Undo2,
    UserCog,
    Users,
} from 'lucide-react';

export interface NavItem {
    title: string;
    href: string;
    icon: LucideIcon;
    /** Extra words the command palette should match. */
    keywords?: string[];
}

export interface NavGroup {
    label: string;
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Overview',
        items: [
            { title: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: ['home', 'today'] },
            { title: 'Analytics', href: '/analytics', icon: BarChart3, keywords: ['reports', 'revenue', 'sales'] },
        ],
    },
    {
        label: 'Orders',
        items: [
            { title: 'Live orders', href: '/orders', icon: Radio, keywords: ['pending', 'active', 'new'] },
            { title: 'Completed', href: '/orders?status=completed', icon: CircleCheck, keywords: ['delivered', 'history'] },
            { title: 'Cancelled & returns', href: '/orders?status=returns', icon: Undo2, keywords: ['refund', 'cancel'] },
        ],
    },
    {
        label: 'Catalog',
        items: [
            { title: 'Products', href: '/products', icon: Package, keywords: ['items', 'sku', 'catalogue'] },
            { title: 'Categories', href: '/categories', icon: FolderTree },
            { title: 'Subcategories', href: '/subcategories', icon: Tags },
            { title: 'Item groups', href: '/item-groups', icon: Layers },
            { title: 'Banners', href: '/banners', icon: GalleryHorizontalEnd, keywords: ['carousel', 'promotions'] },
            { title: 'Inventory', href: '/inventory', icon: Boxes, keywords: ['stock', 'low stock'] },
        ],
    },
    {
        label: 'People',
        items: [
            { title: 'Riders', href: '/riders', icon: Bike, keywords: ['delivery partners', 'drivers'] },
            { title: 'Customers', href: '/customers', icon: Users, keywords: ['users', 'shoppers'] },
        ],
    },
    {
        label: 'Settings',
        items: [
            { title: 'Store & delivery', href: '/settings', icon: Store, keywords: ['fees', 'radius', 'timings', 'delivery'] },
            { title: 'Team & roles', href: '/team', icon: UserCog, keywords: ['staff', 'permissions', 'managers'] },
            { title: 'Audit log', href: '/audit-log', icon: History, keywords: ['activity', 'changes'] },
        ],
    },
];

function parseHref(href: string) {
    const [pathname, search = ''] = href.split('?');
    return { pathname, status: new URLSearchParams(search).get('status') };
}

function normalizePath(pathname: string) {
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/** True when `href` is the page at `pathname` + `search`. Query-less items match only without a status filter. */
export function isNavItemActive(href: string, pathname: string, search: string): boolean {
    const target = parseHref(href);
    if (target.pathname !== normalizePath(pathname)) return false;
    const status = new URLSearchParams(search).get('status');
    return (target.status ?? null) === (status ?? null);
}

/** Group and item for the current location (for breadcrumbs). Falls back to a pathname-only match. */
export function findNavLocation(pathname: string, search: string): { group: NavGroup; item: NavItem } | null {
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if (isNavItemActive(item.href, pathname, search)) return { group, item };
        }
    }
    const path = normalizePath(pathname);
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if (parseHref(item.href).pathname === path) return { group, item };
        }
    }
    return null;
}
