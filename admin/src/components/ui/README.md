# UI primitives

Generated with the shadcn CLI (`components.json`, style `radix-nova`, base colour neutral) and then
adjusted to `docs/design/DESIGN.md`. Re-running `npx shadcn add <name> --overwrite` will undo the
local adjustments listed below, so diff before overwriting.

## Local adjustments

| File | Change |
|---|---|
| `button.tsx` | Sizes one step taller (default 36px, `icon` 36px) for touch; press feedback is `scale(0.98)`; hover uses `--primary-pressed`; transitions list exact properties. |
| `input.tsx`, `select.tsx`, `textarea.tsx` | 36px tall, `bg-card` so fields read on the neutral canvas. |
| `badge.tsx` | Radius 8px instead of a pill; extra variants `success`, `warning`, `brand`, `neutral`. |
| `card.tsx` | Hairline uses `ring-border`. |
| `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` | Overlay is a flat 40% dim; no backdrop blur. |
| `dropdown-menu.tsx`, `popover.tsx`, `select.tsx`, `hover-card.tsx`, `sheet.tsx` | Use the single `shadow-float` elevation. |
| `sidebar.tsx` | `SidebarInset` renders a `div`; the shell provides the one `<main>` landmark. |
| `sonner.tsx` | Reads the admin theme (`hooks/use-theme`) instead of `next-themes`. |

`form` is not part of this shadcn style any more; forms use `field.tsx` with react-hook-form
through the helpers in `components/shared/forms.tsx`.

## Third-party components

### beUI (MIT)

Added from the beUI registry (`@beui` in `components.json`, `https://beui.dev/r/{name}.json`):

| Component | Files | Used by |
|---|---|---|
| `animated-number` | `components/motion/animated-number.tsx`, `lib/ease.ts` | `shared/StatCard` (count-up on first view; static when `prefers-reduced-motion` is set) |
| `date-range-picker` | `components/motion/date-range-picker*`, `popover-morph.tsx`, `popover-position.ts`, `lib/hooks/use-hover-capable.ts` | Available for date filters (orders, analytics). Values are `YYYY-MM-DD` strings; pass `locale="en-IN"`. |

The beUI toast stack was not added: Sonner (`ui/sonner.tsx`) already covers toasts.

beUI is distributed under the MIT License:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions: The above copyright notice and this
> permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
> OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

shadcn/ui is also MIT licensed.
