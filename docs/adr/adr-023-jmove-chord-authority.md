# ADR-023: JMove is the chord authority (no own chord-interpretation code)

Status: Accepted.

Context: Dominant (and other) chords did not sound like the chart
(e.g. a Bb7 that does not sound like Bb7). Root cause, established with
data at chart / generator / rendered-audio levels: LickLab interpreted
chord symbols itself in two places —
`src/domain/chords.ts` (a hand-written suffix table that rejected valid
notations such as `G7alt`, `Bb7/D`, `CM7`, `9sus`, `m9`, `h`, `-7`, `min7`
and collapsed every extension to a core quality) and
`src/adapters/jmove/generator.ts` (a quality switch that simplified
`Bb13`/`Bb7#9` to plain `7`, and mis-mapped `minmaj7`->`"mMaj7"` and
`power5`->`"power5"`, two strings JMove demonstrably misreads).
`@jmove/generator` 1.5.1 (MIT, pinned) already parses 45+ qualities,
iReal aliases, unicode `ø`/`^`/`-`/`+`, slash bass and arbitrary
extensions — its `src/chordQuality.ts` is the reference (read in full;
single source of truth over walkingBass/pianoComping/harmonicAnalysis).

Decision:
1. LickLab keeps NO chord-interpretation code of its own. Quality meaning
   (family, core intervals, scale) comes from JMove's `parseQuality`
   (`src/domain/chords.ts` only splits root/quality/slash lexically and
   applies a small DOCUMENTED alias table for notations JMove 1.5.1
   provably misreads: `°`->`o`, `Δ`->`maj7`, `M7`/`MMaj7`->`maj7`,
   `mMaj7`/`mMaj9`->`m(maj7)`, `power5`->`5`, `7+`->`7#5`, `alt`->`7alt`,
   `♭`/`♯`->`b`/`#`; each cites the upstream cause). Storage categories
   (`ChordQuality`, signature codes, D1 columns) are UNCHANGED and derived
   from JMove's family+intervals — verified byte-stable for every
   previously-valid symbol, so no migration.
2. The JMove adapter is a thin pass-through: root (respelt to
   single-accidental enharmonic for bb/x, which JMove's root reader
   misreads) + canonical quality VERBATIM (extensions/alterations never
   simplified). Slash bass parses but is not sent: `ChordEvent` has no
   bass field and JMove strips `/X` itself — identical to JMove's own
   demo, which builds the same shape (upstream gap, repro in report).
3. No JMove equivalent exists (kept, documented): degree-based lick
   re-rooting with enharmonic spelling (`transpose.ts`, `pitch.ts`),
   matching rules/keys (`signatures.ts`), the offline local fallback
   engine (`domain/band.ts`, now JMove-consistent via the same reader),
   MIDI->note conversion (Tone contract, parity-tested), input typo
   rejection beyond a lexical root (JMove accepts everything).
4. Chunking (budget): the library ships as ONE 400KB bundle without
   `"sideEffects": false`, so any static import from the initial graph
   drags ~140KB of drum/bass/piano tables into the entry chunk (defeats
   the lazy generator chunk; `treeshake.moduleSideEffects` is not honored
   by Vite 7.1 — verified). Therefore the composition root loads
   Dexie/use-cases/local-band/domain-chord code DYNAMICALLY inside the
   (already async) closures, presets move to an application view-model,
   and Library/Detail/New views become `React.lazy`. Entry: 387KB ->
   257KB; chord+jmove stack ships in a lazy `chords-*` chunk.
5. Parity is proven, not asserted: unit tests oracle against JMove
   itself (`parseQuality`/`getChordIntervals`/`getQualityScale`,
   fixed-seed `generateEnsemble` event-for-event); Playwright asserts the
   browser bundle emits the reference take event-for-event (golden file
   `tests/e2e/fixtures/jmove-parity-ref.json`) and that rendered audio
   through the real engine reads bass Bb2, A4=440Hz and a Bb7 shell
   (3/5/b7, no maj7) within +/-30 cents.

Consequences: `G7alt`, `Bb7/D`, `CM7`, `CΔ7`, `C°7`, `C-7`, `Cmin7`,
`C^7`, `Cø`, `Co7`, `Ch7`, `m9/m11/m13`, `69/add9`, `sus2/sus4/9sus`,
`dim`, `aug7`, `+7`, `7#9#5`, `Bb7#9/Bb7b9/Bb13` now parse AND sound
as JMove voices them; previously-valid symbols sound and match exactly
as before. Upstream reports owed: case-sensitive `mMaj7`/`M7`/`power5`
handling, `Δ` normalization, `°` alias, slash-bass generation support.
No node_modules patch, no fork, no weakened JMove features.
