import * as React from "react";
import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-lg bg-[var(--bg-tertiary)]",
                className
            )}
            style={{
                background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
            }}
            {...props}
        />
    );
}

export { Skeleton };
