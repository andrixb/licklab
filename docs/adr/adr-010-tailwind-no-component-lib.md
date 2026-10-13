# ADR-010: Tailwind v4 for styling, no component library

Status: Accepted.
Context: Owner found the M1 styling weak and asked for better visuals with
separated styles, then directed Tailwind over a component framework (Radix was
tried and removed).
Decision: Tailwind CSS v4 via `@tailwindcss/vite` (MIT; GPL-compatible).
Design tokens live in `src/ui/theme.css` `@theme` (dark jazz-club palette);
shared class sets in `src/ui/primitives.ts`; per-component utilities inline in
TSX. Dropdown menu and confirm dialogs are hand-rolled (`ConfirmDialog` =
native `<dialog>`; AccountMenu = state + outside-click + `role=menu`) — no
runtime component deps.
Consequences: small CSS bundle, no lock-in; accessibility burden for menus and
dialogs stays ours (roles, focus outlines, aria-pressed/expanded kept); if a
future primitive needs real focus-trapping, revisit a headless lib case-by-case.
License note: MIT ✓; Radix (Apache/MIT) also fine but removed by owner choice.
