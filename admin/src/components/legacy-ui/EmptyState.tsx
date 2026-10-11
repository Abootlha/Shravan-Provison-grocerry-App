import * as React from "react";
import { Package, ShoppingBag, Search, AlertTriangle, Tags, BarChart2 } from "lucide-react";

interface EmptyStateProps {
    type?: 'default' | 'products' | 'orders' | 'search' | 'error' | 'categories' | 'analytics';
    title?: string;
    description?: string;
    action?: React.ReactNode;
}

const configs = {
    default: {
        icon: Package,
        title: "No data available",
        description: "There's nothing to display here yet.",
    },
    products: {
        icon: ShoppingBag,
        title: "No products found",
        description: "Start by adding your first product to the inventory.",
    },
    orders: {
        icon: Package,
        title: "No orders yet",
        description: "Orders will appear here once customers start placing them.",
    },
    search: {
        icon: Search,
        title: "No results found",
        description: "Try adjusting your search or filters to find what you're looking for.",
    },
    error: {
        icon: AlertTriangle,
        title: "Something went wrong",
        description: "We couldn't load the data. Please try again later.",
    },
    categories: {
        icon: Tags,
        title: "No categories found",
        description: "Create your first category to organize products.",
    },
    analytics: {
        icon: BarChart2,
        title: "No analytics data",
        description: "Analytics will appear once you have more store activity.",
    },
};

export function EmptyState({ type = 'default', title, description, action }: EmptyStateProps) {
    const config = configs[type];
    const Icon = config.icon;

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform hover:scale-110"
                style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)'
                }}
            >
                <Icon
                    className="w-10 h-10"
                    style={{ color: 'var(--text-muted)' }}
                />
            </div>
            <h3
                className="text-lg font-display font-semibold text-center mb-2"
                style={{ color: 'var(--text-primary)' }}
            >
                {title || config.title}
            </h3>
            <p
                className="text-sm text-center max-w-sm mb-6"
                style={{ color: 'var(--text-muted)' }}
            >
                {description || config.description}
            </p>
            {action && <div>{action}</div>}
        </div>
    );
}
