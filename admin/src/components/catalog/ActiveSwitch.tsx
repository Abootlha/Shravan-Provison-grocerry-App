import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Row-level "show in the app" switch with its state spelled out on hover. */
export function ActiveSwitch({
    name,
    checked,
    disabled,
    onCheckedChange,
}: {
    name: string;
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (next: boolean) => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">
                    <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={onCheckedChange}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Show ${name} in the app`}
                    />
                </span>
            </TooltipTrigger>
            <TooltipContent>{disabled ? 'Only admins can change this' : checked ? 'Shown in the app' : 'Hidden from the app'}</TooltipContent>
        </Tooltip>
    );
}
