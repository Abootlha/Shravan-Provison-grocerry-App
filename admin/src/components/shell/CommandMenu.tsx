import * as React from 'react';
import { FolderPlus, Loader2, LogOut, Moon, PackagePlus, Sun } from 'lucide-react';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import {
    type CommandAction,
    getCommandActions,
    getCommandProviders,
    onCommandPaletteOpen,
    subscribeCommands,
} from './command-registry';
import { NAV_GROUPS } from './nav';

const BUILT_IN_ACTIONS: CommandAction[] = [
    { id: 'new-product', label: 'New product', group: 'Actions', icon: PackagePlus, href: '/products?action=new', keywords: ['add', 'create', 'item'] },
    { id: 'new-category', label: 'New category', group: 'Actions', icon: FolderPlus, href: '/categories?action=new', keywords: ['add', 'create'] },
];

function useRegistry() {
    const actions = React.useSyncExternalStore(subscribeCommands, getCommandActions, getCommandActions);
    const providers = React.useSyncExternalStore(subscribeCommands, getCommandProviders, getCommandProviders);
    return { actions, providers };
}

function groupBy(items: CommandAction[]) {
    const groups = new Map<string, CommandAction[]>();
    for (const item of items) {
        const list = groups.get(item.group) ?? [];
        list.push(item);
        groups.set(item.group, list);
    }
    return [...groups.entries()];
}

/** Results from registered search providers, debounced and cancelled on each keystroke. */
function useProviderResults(query: string, open: boolean) {
    const { providers } = useRegistry();
    const [results, setResults] = React.useState<CommandAction[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const q = query.trim();
        const active = providers.filter((p) => q.length >= (p.minQueryLength ?? 2));
        if (!open || active.length === 0) {
            setResults([]);
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        setLoading(true);
        const timer = window.setTimeout(async () => {
            const settled = await Promise.allSettled(
                active.map(async (p) => {
                    const items = await p.search(q, controller.signal);
                    return items.map((item) => ({ ...item, group: item.group || p.group }));
                }),
            );
            if (controller.signal.aborted) return;
            setResults(settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
            setLoading(false);
        }, 200);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query, open, providers]);

    return { results, loading };
}

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const { actions } = useRegistry();
    const { resolved, setPreference } = useTheme();
    const { results, loading } = useProviderResults(query, open);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setOpen((value) => !value);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        const off = onCommandPaletteOpen(() => setOpen(true));
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            off();
        };
    }, []);

    React.useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const run = (action: CommandAction) => {
        setOpen(false);
        if (action.run) action.run();
        else if (action.href) window.location.href = action.href;
    };

    const registered = groupBy([...BUILT_IN_ACTIONS, ...actions]);
    const remote = groupBy(results);

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Search and commands"
            description="Jump to a page or run an action"
            className="sm:max-w-xl data-open:animate-none data-closed:animate-none"
        >
            <Command loop>
                <CommandInput placeholder="Search pages and actions…" value={query} onValueChange={setQuery} />
                <CommandList className="max-h-[min(420px,60vh)]">
                    <CommandEmpty>{loading ? 'Searching…' : 'No matches. Try a page name like "Orders".'}</CommandEmpty>

                    {remote.map(([group, items]) => (
                        <CommandGroup key={`remote-${group}`} heading={group}>
                            {items.map((item) => (
                                <CommandItem
                                    key={`remote-${item.id}`}
                                    value={`${group} ${item.label} ${item.id}`}
                                    keywords={[query, ...(item.keywords ?? [])]}
                                    onSelect={() => run(item)}
                                >
                                    {item.icon ? <item.icon aria-hidden /> : null}
                                    <span className="truncate">{item.label}</span>
                                    {item.hint ? <CommandShortcut>{item.hint}</CommandShortcut> : null}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                    {loading && remote.length === 0 && query.trim().length >= 2 ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground" role="status">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Searching…
                        </div>
                    ) : null}

                    {NAV_GROUPS.map((group) => (
                        <CommandGroup key={group.label} heading={group.label}>
                            {group.items.map((item) => (
                                <CommandItem
                                    key={item.href}
                                    value={`go ${group.label} ${item.title}`}
                                    keywords={item.keywords}
                                    onSelect={() => run({ id: item.href, label: item.title, group: group.label, href: item.href })}
                                >
                                    <item.icon aria-hidden />
                                    {item.title}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}

                    <CommandSeparator />
                    {registered.map(([group, items]) => (
                        <CommandGroup key={`actions-${group}`} heading={group}>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={`${group} ${item.label}`}
                                    keywords={item.keywords}
                                    onSelect={() => run(item)}
                                >
                                    {item.icon ? <item.icon aria-hidden /> : null}
                                    {item.label}
                                    {item.hint ? <CommandShortcut>{item.hint}</CommandShortcut> : null}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                    <CommandGroup heading="Preferences">
                        <CommandItem
                            value="theme toggle dark light mode"
                            onSelect={() => {
                                setPreference(resolved === 'dark' ? 'light' : 'dark');
                                setOpen(false);
                            }}
                        >
                            {resolved === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
                            Switch to {resolved === 'dark' ? 'light' : 'dark'} theme
                        </CommandItem>
                        <CommandItem
                            value="log out sign out"
                            onSelect={() => {
                                setOpen(false);
                                void api.logout();
                            }}
                        >
                            <LogOut aria-hidden />
                            Log out
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    );
}
