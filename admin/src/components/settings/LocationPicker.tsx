import * as React from 'react';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { TextareaField } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, http } from '@/lib/http';
import { NumberField } from './fields';
import type { SettingsFormInput, SettingsFormValues } from './schema';

const LocationMap = React.lazy(() => import('./LocationMap'));

type Form = UseFormReturn<SettingsFormInput, unknown, SettingsFormValues>;

interface GeocodeResult {
    formattedAddress?: string;
    latitude?: number | null;
    longitude?: number | null;
}

/** Mappls reverse geocode (proxied): `{ results: [{ formatted_address }] }`. */
function addressFromReverse(data: any): string {
    const first = Array.isArray(data?.results) ? data.results[0] : undefined;
    return (first?.formatted_address || first?.formattedAddress || data?.response?.address || '').trim();
}

function useMounted() {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    return mounted;
}

export function LocationPicker({ form, disabled }: { form: Form; disabled?: boolean }) {
    const mounted = useMounted();
    const [query, setQuery] = React.useState('');
    const [searching, setSearching] = React.useState(false);
    const [locating, setLocating] = React.useState(false);
    const [suggestion, setSuggestion] = React.useState<string | null>(null);
    const latitude = form.watch('latitude');
    const longitude = form.watch('longitude');
    const radius = form.watch('serviceRadiusKm');
    const lookupId = React.useRef(0);

    const setPosition = React.useCallback(
        (lat: number, lng: number) => {
            form.setValue('latitude', lat, { shouldDirty: true, shouldValidate: true });
            form.setValue('longitude', lng, { shouldDirty: true, shouldValidate: true });
        },
        [form],
    );

    /** Suggest (never overwrite) the address for a point picked on the map or from GPS. */
    const suggestAddress = React.useCallback(async (lat: number, lng: number) => {
        const id = ++lookupId.current;
        setSuggestion(null);
        try {
            const data = await http.get('/maps/reverse-geocode', { params: { latitude: lat, longitude: lng }, skipAuth: true });
            const address = addressFromReverse(data);
            if (id === lookupId.current && address) setSuggestion(address);
        } catch {
            // The pin is still saved; the address stays whatever the user typed.
        }
    }, []);

    const pick = React.useCallback(
        (lat: number, lng: number) => {
            setPosition(lat, lng);
            void suggestAddress(lat, lng);
        },
        [setPosition, suggestAddress],
    );

    async function search() {
        const text = query.trim();
        if (text.length < 3) {
            toast.error('Type at least 3 characters to search');
            return;
        }
        setSearching(true);
        try {
            const data = await http.get<{ results?: GeocodeResult[] }>('/maps/geocode', { params: { address: text }, skipAuth: true });
            const hit = data?.results?.find((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number');
            if (!hit) {
                toast.error('No place found for that search', { description: 'Add the area, city or PIN code and try again.' });
                return;
            }
            setPosition(hit.latitude!, hit.longitude!);
            setSuggestion(null);
            if (hit.formattedAddress) {
                form.setValue('pickupAddress', hit.formattedAddress, { shouldDirty: true, shouldValidate: true });
            }
            toast.success('Pin moved to the search result', { description: 'Drag the pin to the exact shop entrance if needed.' });
        } catch (error) {
            toast.error('Search failed', { description: errorMessage(error) });
        } finally {
            setSearching(false);
        }
    }

    function useMyLocation() {
        if (!('geolocation' in navigator)) {
            toast.error('This browser cannot share its location', { description: 'Search for the address instead.' });
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                const lat = Math.round(position.coords.latitude * 1e6) / 1e6;
                const lng = Math.round(position.coords.longitude * 1e6) / 1e6;
                pick(lat, lng);
                toast.success('Pin moved to your current location', {
                    description: `Accurate to about ${Math.round(position.coords.accuracy)} m. Check it before saving.`,
                });
            },
            (error) => {
                setLocating(false);
                toast.error('Could not get your location', {
                    description:
                        error.code === error.PERMISSION_DENIED
                            ? 'Location access is blocked for this site. Allow it in the browser, or search instead.'
                            : 'Try again, or search for the address.',
                });
            },
            { enableHighAccuracy: true, timeout: 10_000 },
        );
    }

    const hasPin = typeof latitude === 'number' && typeof longitude === 'number';

    return (
        <div className="grid gap-5">
            <div className="flex flex-col gap-2 sm:flex-row" role="search" aria-label="Find the store on the map">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search an address, area or PIN code"
                        aria-label="Search an address, area or PIN code"
                        className="pl-9"
                        disabled={disabled}
                        maxLength={300}
                        enterKeyHint="search"
                        onKeyDown={(e) => {
                            // This sits inside the settings form: Enter searches instead of saving.
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void search();
                            }
                        }}
                    />
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => void search()} disabled={disabled || searching} className="flex-1 sm:flex-none">
                        {searching ? <Loader2 className="animate-spin" aria-hidden /> : <MapPin aria-hidden />}
                        Find
                    </Button>
                    <Button type="button" variant="outline" onClick={useMyLocation} disabled={disabled || locating} className="flex-1 sm:flex-none">
                        {locating ? <Loader2 className="animate-spin" aria-hidden /> : <Crosshair aria-hidden />}
                        Use my location
                    </Button>
                </div>
            </div>

            <div className="relative h-72 overflow-hidden rounded-lg ring-1 ring-border sm:h-80">
                {mounted ? (
                    <React.Suspense fallback={<Skeleton className="size-full rounded-none" />}>
                        <LocationMap
                            latitude={latitude}
                            longitude={longitude}
                            radiusKm={typeof radius === 'number' ? radius : undefined}
                            disabled={disabled}
                            onPick={pick}
                        />
                    </React.Suspense>
                ) : (
                    <Skeleton className="size-full rounded-none" />
                )}
                {!hasPin ? (
                    <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-lg bg-card/95 px-3 py-2 text-sm shadow-float ring-1 ring-border">
                        <p className="font-medium text-foreground">No store location yet</p>
                        <p className="text-muted-foreground">Search for the address, use your location, or click the map to drop the pin.</p>
                    </div>
                ) : null}
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
                {disabled ? 'The pin marks the pickup point; the shaded circle is the delivery area.' : 'Click the map or drag the pin to move it. The shaded circle is the delivery area.'}
            </p>

            <div className="grid gap-2">
                <TextareaField
                    form={form}
                    name="pickupAddress"
                    label="Pickup address"
                    description="Shown to riders. Usually the shop's street address."
                    rows={2}
                    disabled={disabled}
                />
                {suggestion && suggestion !== form.getValues('pickupAddress') ? (
                    <div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="min-w-0 text-pretty">
                            <span className="text-muted-foreground">Address at the pin: </span>
                            {suggestion}
                        </p>
                        <div className="flex shrink-0 gap-1">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                                Keep mine
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    form.setValue('pickupAddress', suggestion, { shouldDirty: true, shouldValidate: true });
                                    setSuggestion(null);
                                }}
                            >
                                Use this address
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <NumberField form={form} name="latitude" label="Latitude" disabled={disabled} placeholder="e.g. 26.7503" />
                <NumberField form={form} name="longitude" label="Longitude" disabled={disabled} placeholder="e.g. 83.3748" />
            </div>
        </div>
    );
}
