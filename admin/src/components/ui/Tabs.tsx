import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
}

function Tabs({ defaultValue, value, onValueChange, className, children, ...props }: TabsProps) {
    const [activeTab, setActiveTabState] = React.useState(value || defaultValue || '');

    React.useEffect(() => {
        if (value !== undefined) {
            setActiveTabState(value);
        }
    }, [value]);

    const setActiveTab = (tab: string) => {
        setActiveTabState(tab);
        onValueChange?.(tab);
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={cn("", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

function TabsList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1 p-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.activeTab === value;

    return (
        <button
            type="button"
            onClick={() => context.setActiveTab(value)}
            className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                isActive
                    ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg shadow-[var(--accent-glow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.activeTab !== value) return null;

    return (
        <div
            className={cn("mt-4", className)}
            style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
            {...props}
        >
            {children}
        </div>
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
