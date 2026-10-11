import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

const PHONE_QUERY = "(max-width: 639px)"
const LIFT_VAR = "--toast-lift"

function subscribePhone(callback: () => void) {
  const media = window.matchMedia(PHONE_QUERY)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}

function useIsPhone() {
  return React.useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  )
}

/**
 * Keeps toasts clear of a sticky footer (a save bar, a bulk-action bar): while `ref` is mounted
 * the desktop toast stack sits above it. Phones show toasts at the top, so nothing to do there.
 */
export function useLiftToasts(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const root = document.documentElement
    // Height plus the element's own sticky `bottom` gap: where it sits once stuck to the viewport.
    const apply = () => {
      const gap = parseFloat(getComputedStyle(el).bottom) || 0
      root.style.setProperty(LIFT_VAR, `${Math.round(el.offsetHeight + gap)}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty(LIFT_VAR)
    }
  }, [ref])
}

/** Bottom-right on desktop (above any sticky footer), top-center on phones. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme()
  const isPhone = useIsPhone()

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      position={isPhone ? "top-center" : "bottom-right"}
      offset={{ bottom: `calc(var(${LIFT_VAR}, 0px) + 24px)`, right: 24, top: 24, left: 24 }}
      mobileOffset={{ top: 12, left: 12, right: 12, bottom: 12 }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success-text" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
