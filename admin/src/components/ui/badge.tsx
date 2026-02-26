import * as React from "react";
import { cn } from "../../lib/utils";

const Badge = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    }
>(({ className, variant = "default", ...props }, ref) => {
    const variants = {
        default: "bg-[var(--accent-glow)] text-[var(--accent)] border-transparent",
        secondary: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-transparent",
        destructive: "bg-[var(--danger-light)] text-[var(--danger)] border-transparent",
        outline: "text-[var(--text-secondary)] border-[var(--border)]",
        success: "bg-[var(--success-light)] text-[var(--success)] border-transparent",
        warning: "bg-[var(--warning-light)] text-[var(--warning)] border-transparent",
    };

    return (
        <div
            ref={ref}
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                variants[variant],
                className
            )}
            {...props}
        />
    );
});
Badge.displayName = "Badge";

export { Badge };
