export const COLORS = {
    // Primary brand colors
    primary: '#F8CB46',      // Blinkit yellow
    secondary: '#0C831F',    // Green accent

    // Background colors
    background: '#F4F5F7',
    white: '#FFFFFF',
    surface: '#FFFFFF',

    // Text colors
    text: '#1F1F1F',
    textSecondary: '#666666',
    textLight: '#8B8B8B',

    // Status colors
    success: '#0C831F',
    error: '#E53935',
    warning: '#FF9800',
    info: '#2196F3',

    // Neutral colors
    black: '#000000',
    gray: '#8B8B8B',
    lightGray: '#E8E8E8',
    border: '#E5E5E5',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
};

export const SIZES = {
    // Global sizes
    base: 8,
    font: 14,
    radius: 8,
    padding: 16,

    // Font sizes
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 16,
    body: 14,
    caption: 12,
    small: 10,

    // Screen dimensions
    width: null, // Set dynamically
    height: null, // Set dynamically
};

export const FONTS = {
    h1: {
        fontSize: SIZES.h1,
        fontWeight: '700',
        color: COLORS.text,
    },
    h2: {
        fontSize: SIZES.h2,
        fontWeight: '600',
        color: COLORS.text,
    },
    h3: {
        fontSize: SIZES.h3,
        fontWeight: '600',
        color: COLORS.text,
    },
    h4: {
        fontSize: SIZES.h4,
        fontWeight: '500',
        color: COLORS.text,
    },
    body: {
        fontSize: SIZES.body,
        fontWeight: '400',
        color: COLORS.text,
    },
    caption: {
        fontSize: SIZES.caption,
        fontWeight: '400',
        color: COLORS.textSecondary,
    },
};

export const SHADOWS = {
    light: {
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    medium: {
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    dark: {
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
};
