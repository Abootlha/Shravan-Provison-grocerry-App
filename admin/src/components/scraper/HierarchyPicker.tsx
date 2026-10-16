import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useItemGroups, useSubcategories } from '@/components/catalog/api';

const NONE = '__none__';

export interface HierarchyValue {
    categoryId: string | null;
    subcategoryId: string | null;
    itemGroupId: string | null;
}

const idOf = (value: { _id: string } | string | null | undefined) =>
    !value ? '' : typeof value === 'string' ? value : value._id;

/**
 * Category > subcategory > item group. Changing a level clears the levels below it,
 * and each list only offers children of the level above.
 */
export function HierarchyPicker({
    value,
    onChange,
    disabled,
    idPrefix = 'hierarchy',
}: {
    value: HierarchyValue;
    onChange: (value: HierarchyValue) => void;
    disabled?: boolean;
    idPrefix?: string;
}) {
    const categories = useCategories();
    const subcategories = useSubcategories();
    const itemGroups = useItemGroups();

    const subs = React.useMemo(
        () => (subcategories.data ?? []).filter((s) => value.categoryId && idOf(s.parentId) === value.categoryId),
        [subcategories.data, value.categoryId],
    );
    const groups = React.useMemo(
        () => (itemGroups.data ?? []).filter((g) => value.subcategoryId && idOf(g.subcategoryId) === value.subcategoryId),
        [itemGroups.data, value.subcategoryId],
    );

    const label = (name: string, active: boolean) => (active ? name : `${name} (hidden)`);

    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-category`}>Category</Label>
                <Select
                    value={value.categoryId ?? NONE}
                    disabled={disabled || categories.isLoading}
                    onValueChange={(v) =>
                        onChange({ categoryId: v === NONE ? null : v, subcategoryId: null, itemGroupId: null })
                    }
                >
                    <SelectTrigger id={`${idPrefix}-category`} className="w-full">
                        <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>No category</SelectItem>
                        {(categories.data ?? []).map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                                {label(c.name, c.isActive)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-subcategory`}>Subcategory</Label>
                <Select
                    value={value.subcategoryId ?? NONE}
                    disabled={disabled || !value.categoryId || subs.length === 0}
                    onValueChange={(v) => onChange({ ...value, subcategoryId: v === NONE ? null : v, itemGroupId: null })}
                >
                    <SelectTrigger id={`${idPrefix}-subcategory`} className="w-full">
                        <SelectValue placeholder={value.categoryId ? 'Optional' : 'Pick a category first'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {subs.map((s) => (
                            <SelectItem key={s._id} value={s._id}>
                                {label(s.name, s.isActive)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-item-group`}>Item group</Label>
                <Select
                    value={value.itemGroupId ?? NONE}
                    disabled={disabled || !value.subcategoryId || groups.length === 0}
                    onValueChange={(v) => onChange({ ...value, itemGroupId: v === NONE ? null : v })}
                >
                    <SelectTrigger id={`${idPrefix}-item-group`} className="w-full">
                        <SelectValue placeholder={value.subcategoryId ? 'Optional' : 'Pick a subcategory first'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {groups.map((g) => (
                            <SelectItem key={g._id} value={g._id}>
                                {label(g.name, g.isActive)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

/** "Dairy › Milk › Toned Milk" for a stored hierarchy, from the cached catalogue lists. */
export function useHierarchyLabel() {
    const categories = useCategories();
    const subcategories = useSubcategories();
    const itemGroups = useItemGroups();
    return React.useCallback(
        (ids: { categoryId?: string | null; subcategoryId?: string | null; itemGroupId?: string | null }) => {
            const names = [
                categories.data?.find((c) => c._id === ids.categoryId)?.name,
                subcategories.data?.find((s) => s._id === ids.subcategoryId)?.name,
                itemGroups.data?.find((g) => g._id === ids.itemGroupId)?.name,
            ].filter(Boolean);
            return names.length ? names.join(' › ') : '';
        },
        [categories.data, subcategories.data, itemGroups.data],
    );
}
