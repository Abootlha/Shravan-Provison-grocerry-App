import { statusLabel } from '@/components/shared/StatusBadge';

export interface AuditLog {
    _id: string;
    actorId?: string;
    actorName?: string;
    role?: string;
    action: string;
    entity: string;
    entityId?: string;
    summary?: string;
    diff?: { changes?: Record<string, unknown>; truncated?: boolean; keys?: string[] } | null;
    ip?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    createdAt: string;
}

export interface AuditLogResponse {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/** Entities the backend records, with the noun used in sentences. Unknown ones fall back to their slug. */
export const ENTITIES: Record<string, { label: string; noun: string }> = {
    orders: { label: 'Orders', noun: 'order' },
    products: { label: 'Products', noun: 'product' },
    categories: { label: 'Categories', noun: 'category' },
    subcategories: { label: 'Subcategories', noun: 'subcategory' },
    'item-groups': { label: 'Item groups', noun: 'item group' },
    banners: { label: 'Banners', noun: 'banner' },
    riders: { label: 'Riders', noun: 'rider' },
    customers: { label: 'Customers', noun: 'customer' },
    settings: { label: 'Store settings', noun: 'store settings' },
    team: { label: 'Team', noun: 'staff account' },
};

const VERBS: Record<string, string> = { create: 'Created', update: 'Updated', delete: 'Deleted' };

const FIELD_LABELS: Record<string, string> = {
    isActive: 'active',
    vehicleType: 'vehicle',
    reorderLevel: 'reorder level',
    riderId: 'rider',
    orderStatus: 'status',
    deliveryFee: 'delivery fee',
    packagingFee: 'packaging fee',
    minOrderValue: 'minimum order',
    deliveryRadius: 'delivery radius',
};

/** "deliveryRadiusKm" → "delivery radius km". */
export function humanizeKey(key: string): string {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .trim();
}

const noun = (entity: string) => ENTITIES[entity]?.noun ?? humanizeKey(entity).replace(/s$/, '');

const quoted = (v: unknown) => (typeof v === 'string' && v.trim() ? `"${v.trim()}"` : null);

/** A human sentence for one audit entry, plus the changed fields (never raw values). */
export function describeAudit(log: Pick<AuditLog, 'action' | 'entity' | 'diff'>): { title: string; fields: string[] } {
    const changes = (log.diff?.changes ?? {}) as Record<string, any>;
    const fields = (log.diff?.changes ? Object.keys(changes) : (log.diff?.keys ?? [])).map(humanizeKey);
    const subject = quoted(changes.name) ?? quoted(changes.title) ?? quoted(changes.username);
    const n = noun(log.entity);
    const suffix = log.action.startsWith(`${log.entity}.`) ? log.action.slice(log.entity.length + 1) : log.action;

    const title = (() => {
        switch (log.action) {
            case 'settings.update':
                return 'Updated store settings';
            case 'products.stock-adjustments': {
                const delta = Number(changes.delta);
                const amount = Number.isFinite(delta) ? `${delta > 0 ? '+' : ''}${delta}` : null;
                const reason = typeof changes.reason === 'string' ? ` (${humanizeKey(changes.reason)})` : '';
                return amount ? `Adjusted stock by ${amount}${reason}` : `Adjusted stock${reason}`;
            }
            case 'products.reorder-level':
                return changes.reorderLevel !== undefined ? `Set reorder level to ${changes.reorderLevel}` : 'Changed a reorder level';
            case 'products.bulk-status': {
                const count = Array.isArray(changes.ids) ? changes.ids.length : null;
                const to = typeof changes.status === 'string' ? ` to ${statusLabel('product', changes.status).toLowerCase()}` : '';
                return count ? `Changed ${count} products${to}` : `Changed product status in bulk${to}`;
            }
            case 'products.status':
                if (typeof changes.status === 'string') return `Set product to ${statusLabel('product', changes.status).toLowerCase()}`;
                if (changes.isActive === false) return 'Hid a product';
                if (changes.isActive === true) return 'Made a product visible';
                return 'Changed product status';
            case 'orders.status':
                return typeof changes.status === 'string'
                    ? `Moved order to ${statusLabel('order', changes.status).toLowerCase()}`
                    : 'Changed order status';
            case 'orders.assign-rider':
                return 'Assigned a rider to an order';
            case 'orders.unassign-rider':
                return 'Took the rider off an order';
            case 'riders.status':
                return changes.isActive === false ? 'Deactivated a rider' : changes.isActive === true ? 'Reactivated a rider' : 'Changed rider status';
            case 'riders.create':
                return subject ? `Added rider ${subject}` : 'Added a rider';
            case 'banners.reorder':
                return 'Reordered banners';
            case 'team.create': {
                const role = changes.role === 'admin' ? 'an admin' : changes.role === 'manager' ? 'a manager' : 'a staff member';
                return subject ? `Added ${subject} as ${role}` : `Added ${role}`;
            }
            case 'team.update':
                if (changes.role) return `Changed a staff role to ${changes.role}`;
                if (changes.isActive === false) return 'Deactivated a staff account';
                if (changes.isActive === true) return 'Reactivated a staff account';
                if ('password' in changes) return 'Reset a staff password';
                return 'Updated a staff account';
        }
        const verb = VERBS[suffix];
        if (verb) {
            if (subject) return `${verb} ${n} ${subject}`;
            return n === 'store settings' ? `${verb} store settings` : `${verb} a${/^[aeiou]/.test(n) ? 'n' : ''} ${n}`;
        }
        const area = ENTITIES[log.entity]?.label ?? humanizeKey(log.entity);
        return `${area}: ${humanizeKey(suffix.replace(/\./g, ' '))}`;
    })();

    return { title, fields };
}
