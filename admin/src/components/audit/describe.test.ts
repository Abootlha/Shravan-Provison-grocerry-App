import { describe, expect, it } from 'vitest';
import { describeAudit, humanizeKey } from './describe';

const log = (action: string, entity: string, changes?: Record<string, unknown>) => ({
    action,
    entity,
    diff: changes ? { changes } : null,
});

describe('describeAudit', () => {
    it('describes stock adjustments with the delta and reason', () => {
        expect(describeAudit(log('products.stock-adjustments', 'products', { delta: -3, reason: 'damage' })).title).toBe(
            'Adjusted stock by -3 (damage)',
        );
    });

    it('describes order status moves with the status label', () => {
        expect(describeAudit(log('orders.status', 'orders', { status: 'OUT_FOR_DELIVERY' })).title).toBe(
            'Moved order to out for delivery',
        );
    });

    it('describes rider deactivation', () => {
        expect(describeAudit(log('riders.status', 'riders', { isActive: false })).title).toBe('Deactivated a rider');
    });

    it('names the subject on generic creates and updates', () => {
        expect(describeAudit(log('categories.create', 'categories', { name: 'Dairy' })).title).toBe('Created category "Dairy"');
        expect(describeAudit(log('banners.update', 'banners')).title).toBe('Updated a banner');
    });

    it('lists changed fields in plain words, not values', () => {
        const result = describeAudit(log('riders.update', 'riders', { name: 'Ravi', vehicleType: 'Bicycle' }));
        expect(result.fields).toEqual(['name', 'vehicle']);
    });

    it('uses truncated keys when the body was too large', () => {
        const result = describeAudit({ action: 'settings.update', entity: 'settings', diff: { truncated: true, keys: ['deliveryFee'] } });
        expect(result).toEqual({ title: 'Updated store settings', fields: ['delivery fee'] });
    });

    it('falls back to a readable sentence for unknown actions', () => {
        expect(describeAudit(log('item-groups.reorder', 'item-groups')).title).toBe('Item groups: reorder');
    });
});

describe('humanizeKey', () => {
    it('splits camel case and dashes', () => {
        expect(humanizeKey('freeDeliveryAbove')).toBe('free delivery above');
        expect(humanizeKey('assign-rider')).toBe('assign rider');
    });
});
