import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "../../lib/utils";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

function Breadcrumb({ items, className }: BreadcrumbProps) {
    return (
        <nav className={cn("flex items-center gap-1 text-sm", className)}>
            <a
                href="/"
                className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <Home className="w-4 h-4" />
            </a>
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                    {item.href ? (
                        <a
                            href={item.href}
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            {item.label}
                        </a>
                    ) : (
                        <span className="text-gray-900 font-medium">{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

export { Breadcrumb };
export type { BreadcrumbItem };
