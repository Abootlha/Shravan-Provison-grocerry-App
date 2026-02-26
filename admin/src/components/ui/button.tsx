import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-[var(--accent)] text-[var(--bg-primary)] hover:brightness-110 hover:-translate-y-0.5 shadow-lg shadow-[var(--accent-glow)]",
                destructive: "bg-[var(--danger)] text-white hover:brightness-110",
                outline: "border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]",
                secondary: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
                ghost: "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                link: "text-[var(--accent)] underline-offset-4 hover:underline",
                success: "bg-[var(--success)] text-white hover:brightness-110",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-9 rounded-lg px-4",
                lg: "h-12 rounded-xl px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
