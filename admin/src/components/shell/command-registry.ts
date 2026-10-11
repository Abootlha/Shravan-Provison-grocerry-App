import type { LucideIcon } from 'lucide-react';

/**
 * Command palette registry. The shell renders the palette; any island can add commands or
 * a search provider (e.g. Products searching the API) without importing the shell.
 * The registry is a module singleton shared by every island on the page.
 */
export interface CommandAction {
    id: string;
    label: string;
    /** Group heading in the palette, e.g. "Actions" or "Products". */
    group: string;
    icon?: LucideIcon;
    keywords?: string[];
    /** Short hint on the right, e.g. a SKU or a status. */
    hint?: string;
    /** Navigate here when chosen... */
    href?: string;
    /** ...or run this. */
    run?: () => void;
}

export interface CommandSearchProvider {
    id: string;
    /** Heading for this provider's results. */
    group: string;
    /** Minimum query length before `search` is called. Default 2. */
    minQueryLength?: number;
    /** Return matches for the query. Called debounced; stop work when `signal` aborts. */
    search: (query: string, signal: AbortSignal) => Promise<CommandAction[]> | CommandAction[];
}

type Listener = () => void;

let actions: CommandAction[] = [];
let providers: CommandSearchProvider[] = [];
const listeners = new Set<Listener>();

function emit() {
    listeners.forEach((listener) => listener());
}

export function subscribeCommands(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getCommandActions() {
    return actions;
}

export function getCommandProviders() {
    return providers;
}

/** Adds commands; returns a function that removes them (use it as a useEffect cleanup). */
export function registerCommands(next: CommandAction[]) {
    const ids = new Set(next.map((a) => a.id));
    actions = [...actions.filter((a) => !ids.has(a.id)), ...next];
    emit();
    return () => {
        actions = actions.filter((a) => !ids.has(a.id));
        emit();
    };
}

/** Adds a search provider; returns an unregister function. */
export function registerSearchProvider(provider: CommandSearchProvider) {
    providers = [...providers.filter((p) => p.id !== provider.id), provider];
    emit();
    return () => {
        providers = providers.filter((p) => p.id !== provider.id);
        emit();
    };
}

const OPEN_EVENT = 'admin-command-open';

/** Opens the palette from anywhere (e.g. a search button inside a page). */
export function openCommandPalette() {
    window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onCommandPaletteOpen(handler: () => void) {
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
}
