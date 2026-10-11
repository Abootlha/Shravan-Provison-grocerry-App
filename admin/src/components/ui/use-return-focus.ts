import * as React from "react"

/**
 * Radix dialogs return focus to their Trigger on close. Most admin sheets and dialogs open from
 * state (a table row, a menu item, ⌘K) with no Trigger, so focus fell to <body> and keyboard users
 * lost their place. This remembers what had focus when the layer opened and puts it back on close,
 * when that element still exists. Pass the result's handlers to a Radix Content.
 */
export function useReturnFocus(
  onOpenAutoFocus?: (event: Event) => void,
  onCloseAutoFocus?: (event: Event) => void
) {
  const returnTo = React.useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const target = returnTo.current
      returnTo.current = null
      if (target?.isConnected) {
        event.preventDefault()
        target.focus({ preventScroll: true })
      }
    },
  }
}
