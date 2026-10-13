# ui rules

React components + view-models only. No business logic (that lives in domain/
use cases). Talk to use cases, never to adapters directly. The single exception
is `composition.ts` (composition root, lint-excepted): it wires Dexie/Verovio
adapters to use-case closures; every other file imports composition, application
or domain only. Mobile-friendly, large touch targets (at the instrument).
Mock audio/MIDI in e2e tests.

Styling (ADR-010): Tailwind v4 utilities in TSX only. Design tokens =
`theme.css` `@theme`; shared class strings = `primitives.ts` (add there, don't
re-litigate class soup per file). **Never stack conflicting color utilities**
(a button gets exactly one bg-*/text-*; variants carry their own colors, the
base carries none) — v4 cascade order for conflicts is alphabetical-ish and
produces invisible dark-on-dark text (bit us once). No component libraries,
no CSS modules, no inline `style={{}}` in new code. Confirmations use
`ConfirmDialog.tsx` (native dialog); menus handle their own outside-click +
roles. Heavy chunks (notation, account menu) load lazily.
