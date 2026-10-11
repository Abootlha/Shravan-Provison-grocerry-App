/**
 * EmptyState (app-level) — thin wrapper over ui/EmptyState that keeps the legacy preset API.
 * The (static) mascot is allowed here: DESIGN.md puts it on empty / error states only. Copy names
 * the cause, then one action. No 3D sticker props.
 *
 * Props
 *   type         'cart' | 'orders' | 'search' | 'favorites' — picks bilingual default copy + mood
 *   title, subtitle, actionLabel   override the preset copy
 *   onAction     shows the primary button when an action label exists
 *   mood         override the mascot mood
 *   secondaryLabel / onSecondary, compact, style   passed through
 *   icon         legacy prop, ignored (the mascot replaces icons)
 *   sticker      legacy prop, ignored (no floating sticker clusters)
 */
import React from 'react';
import { EmptyState as UIEmptyState } from './ui';
import { useTranslation } from '../hooks/useTranslation';

const PRESETS = {
    cart: {
        mood: 'sleepy',
        en: ['Your cart is empty', 'Items you add from the store show up here.', 'Start shopping'],
        hi: ['आपकी कार्ट खाली है', 'स्टोर से जोड़ा गया सामान यहाँ दिखेगा।', 'खरीदारी शुरू करें'],
    },
    orders: {
        mood: 'sleepy',
        en: ['No orders yet', 'Your order history will appear here once you place your first order.', 'Browse products'],
        hi: ['कोई ऑर्डर नहीं', 'ऑर्डर करने के बाद आपका इतिहास यहाँ दिखेगा।', 'सामान देखें'],
    },
    search: {
        mood: 'sad',
        en: ['No results found', 'Try a different word, or browse a category instead.', null],
        hi: ['कोई परिणाम नहीं मिला', 'अन्य शब्दों से खोजें या कोई श्रेणी देखें।', null],
    },
    favorites: {
        mood: 'sleepy',
        en: ['No favourites yet', 'Tap the heart on any product to save it here for later.', 'Explore products'],
        hi: ['कोई पसंदीदा सामान नहीं', 'किसी भी सामान पर दिल दबाकर उसे यहाँ सेव करें।', 'सामान खोजें'],
    },
};

const EmptyState = ({
    type = 'cart',
    title,
    subtitle,
    actionLabel,
    onAction,
    mood,
    secondaryLabel,
    onSecondary,
    compact,
    style,
}) => {
    const { isHi } = useTranslation();
    const preset = PRESETS[type] || PRESETS.cart;
    const [pTitle, pSubtitle, pAction] = isHi ? preset.hi : preset.en;
    const label = actionLabel || pAction;

    return (
        <UIEmptyState
            mood={mood || preset.mood}
            title={title || pTitle}
            subtitle={subtitle || pSubtitle}
            actionLabel={onAction && label ? label : undefined}
            onAction={onAction}
            secondaryLabel={secondaryLabel}
            onSecondary={onSecondary}
            compact={compact}
            style={style}
        />
    );
};

export default EmptyState;
