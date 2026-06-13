# Mobile Navigation Fix

Add a sticky bottom tab bar for mobile while keeping the existing top navbar for desktop, and tighten the header so it doesn't crowd on small screens.

## 1. New component: `src/components/bottom-nav.tsx`

A fixed bottom tab bar, mobile-only (`md:hidden`), rendered once at the layout level.

- Container: `fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden` with `pb-[env(safe-area-inset-bottom)]`.
- Grid of equal-width tabs (`grid grid-cols-3`), each a TanStack `<Link>` with `activeProps` highlighting (text-foreground + primary indicator), inactive items use `text-muted-foreground`.
- Tabs (matching current top nav):
  - `/` — Trophy icon — "Placar"
  - `/meses` — Calendar icon — "Meses"
  - `/atletas` — Users icon — "Atletas"
- Each tab: vertical stack, 20px icon above 11px label, ~56px tall tap target.

Admin-only "Importar" stays in the header (not a primary public route, so it doesn't belong in the bottom bar).

## 2. `src/components/site-header.tsx` tweaks

- Hide desktop nav links on mobile (already `hidden md:flex` — keep).
- Shrink the brand block on mobile so it doesn't wrap or clip:
  - Wrap title row in `min-w-0` containers; add `truncate` on the title.
  - Reduce title size on mobile: `text-base md:text-lg`.
  - Hide the "placar · temporada…" subtitle on mobile (`hidden sm:block`) — that's the line that pushes the header wide.
- Right cluster: keep `Importar` button visible to admin on mobile but use `size="sm"` and hide its text label on very small widths (icon-only via `<span className="hidden xs:inline">Importar</span>` → use `sm:inline`), so admin still sees an upload icon button.
- Apply the responsive header pattern: outer row `grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center sm:justify-between`, brand link gets `min-w-0`, logo square gets `shrink-0`.

## 3. `src/routes/__root.tsx` layout wrapper

- Import and render `<BottomNav />` inside `RootComponent`, after `<main>`.
- Add bottom padding to `<main>` on mobile so content isn't hidden behind the bar: `pb-20 md:pb-10`.

## Out of scope

- No route changes, no business logic changes, no styling system changes beyond what's described.
- Auth state, admin gating, and existing routes remain identical.

## Technical notes

- All icons from `lucide-react` (already a dep).
- Uses Tailwind responsive prefixes only; no JS breakpoint hook needed (avoids SSR hydration mismatch from `useIsMobile`).
- `activeProps` on `<Link>` with `activeOptions={{ exact: true }}` for `/` so it doesn't stay active on `/meses`.
