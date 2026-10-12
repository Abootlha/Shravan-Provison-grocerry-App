import { StatCard, type StatCardProps } from '@/components/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { errorMessage } from '@/lib/http';

/**
 * StatCard that explains a missing value. When the request failed, the card shows "—" and a
 * tooltip (and keyboard-focusable hint) with the reason, instead of a made-up number.
 */
export function KpiCard({ error, ...props }: StatCardProps & { error?: unknown }) {
    if (!error) return <StatCard {...props} />;
    const reason = errorMessage(error);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div tabIndex={0} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${props.label}: unavailable. ${reason}`}>
                    <StatCard {...props} value={null} delta={undefined} hint="Unavailable right now" href={undefined} />
                </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">Couldn't load this number. {reason}</TooltipContent>
        </Tooltip>
    );
}
