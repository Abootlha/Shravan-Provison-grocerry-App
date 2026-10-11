import { type LucideIcon, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { PageContainer, PageHeader } from './PageHeader';

export interface BeingBuiltProps {
    title: string;
    description: string;
    /** What the finished page will let the team do. */
    plannedFor: string;
    icon?: LucideIcon;
}

/** Honest placeholder for a route that exists in the navigation but is not built yet. No numbers. */
export function BeingBuilt({ title, description, plannedFor, icon = Construction }: BeingBuiltProps) {
    return (
        <PageContainer>
            <PageHeader title={title} description={description} />
            <div className="rounded-xl border border-dashed bg-card">
                <EmptyState
                    size="page"
                    icon={icon}
                    title="This page is being built"
                    description={plannedFor}
                    action={
                        <Button variant="outline" asChild>
                            <a href="/">Back to dashboard</a>
                        </Button>
                    }
                />
            </div>
        </PageContainer>
    );
}

export default BeingBuilt;
