import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query';

/**
 * Wrap every React island's root in this. All islands share the same QueryClient instance
 * (module singleton), so cache and invalidations are page-wide.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </QueryClientProvider>
    );
}

/** HOC form for page islands: `export default withProviders(ProductsPage)`. */
export function withProviders<P extends object>(Component: React.ComponentType<P>) {
    function WithProviders(props: P) {
        return (
            <Providers>
                <Component {...props} />
            </Providers>
        );
    }
    WithProviders.displayName = `withProviders(${Component.displayName || Component.name || 'Component'})`;
    return WithProviders;
}
