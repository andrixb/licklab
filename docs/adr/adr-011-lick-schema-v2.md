# ADR-011: Lick schema v2 — community fields + derived signatures

Status: Accepted (M2).
Context: The community database needs licks searchable by key-independent
signatures, visibility, license and moderation state. v1 stored only the
author-declared function label.
Decision: `LICK_SCHEMA_VERSION = 2` adds `contextKey`, `functionKey`,
`chordQuality`, `patternHash` (ALWAYS derived in `parseLick` — input values
are ignored, so stored data can never drift), plus `visibility`
(default "private"), `license` (default "CC BY 4.0", ADR-015) and
`moderationState` (default "approved"; local licks are not moderated).
Content limits tightened per product spec: ≤64 notes, context ≤32 beats
(8 bars of 4/4), pattern must not overflow its declared context.
Migration: `parseLick` accepts schemaVersion 1 or 2 and normalizes output to
2. Dexie v1 rows re-parse on read (store schema unchanged — full JSON lives
in `data`); first write re-saves as v2. No data rewrite, no destructive
change; JSON exports carry `schemaVersion`. `harmonicContext.function`
(author label) is kept for display; `functionKey` (derived) is the match
field.
Consequences: Worker/D1 (M4) index the derived strings; duplicate detection
uses `patternHash`.
