import {
    Ban,
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
    UserCog,
    Users,
} from 'lucide-react';

export interface NavItem {
    title: string;
    href: string;
    icon: LucideIcon;
    /** Extra words the command palette should match. */
    keywords?: string[];
    /** Other ?status= values that open the same page (old links, synonyms). */
    aliases?: string[];
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
            { title: 'Live orders', href: '/orders', icon: Radio, keywords: ['pending', 'active', 'new'], aliases: ['live'] },
            { title: 'Delivered', href: '/orders?status=completed', icon: CircleCheck, keywords: ['completed', 'history'], aliases: ['delivered'] },
            { title: 'Cancelled', href: '/orders?status=cancelled', icon: Ban, keywords: ['refund', 'cancel', 'returns'], aliases: ['returns'] },
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
            { title: 'Store & delivery', href: '/settings', icon: Store, keywords: ['fees', 'radius', 'timings', 'hours', 'delivery', 'location', 'map', 'pause', 'gstin', 'contact'] },
            { title: 'Team & roles', href: '/team', icon: UserCog, keywords: ['staff', 'permissions', 'managers'] },
            { title: 'Audit log', href: '/audit-log', icon: History, keywords: ['activity', 'changes'] },
        ],
    },
];

/**
 * Query-param tabs that have no sidebar entry but still need their own breadcrumb, so
 * /orders?status=all reads "All orders" instead of borrowing "Live orders".
 */
const UNLISTED_LOCATIONS: { group: string; item: NavItem }[] = [
    { group: 'Orders', item: { title: 'All orders', href: '/orders?status=all', icon: Radio } },
];

function parseHref(href: string) {
    const [pathname, search = ''] = href.split('?');
    return { pathname, status: new URLSearchParams(search).get('status') };
}

function normalizePath(pathname: string) {
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/**
 * True when `item` is the page at `pathname` + `search`. A query-less item matches only without a
 * status filter (or one of its `aliases`); an item with ?status=x matches x or its aliases.
 */
export function isNavItemActive(item: NavItem | string, pathname: string, search: string): boolean {
    const { href, aliases = [] } = typeof item === 'string' ? { href: item } : item;
    const target = parseHref(href);
    if (target.pathname !== normalizePath(pathname)) return false;
    const status = new URLSearchParams(search).get('status') || null;
    return status === target.status || (status !== null && aliases.includes(status));
}

/** Group and item for the current location (for breadcrumbs). Falls back to a pathname-only match. */
export function findNavLocation(pathname: string, search: string): { group: NavGroup; item: NavItem } | null {
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if (isNavItemActive(item, pathname, search)) return { group, item };
        }
    }
    for (const extra of UNLISTED_LOCATIONS) {
        const group = NAV_GROUPS.find((g) => g.label === extra.group);
        if (group && isNavItemActive(extra.item, pathname, search)) return { group, item: extra.item };
    }
    // Unknown ?status= value: name the page by its group rather than claiming a specific tab.
    const path = normalizePath(pathname);
    for (const group of NAV_GROUPS) {
        const items = group.items.filter((item) => parseHref(item.href).pathname === path);
        if (items.length === 1) return { group, item: items[0] };
        if (items.length > 1) return { group, item: { ...items[0], title: group.label, href: path } };
    }
    return null;
}
