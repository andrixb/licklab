# ADR-009: License the code under GPL-3.0-or-later

Status: Accepted.
Context: Project had no license file. Owner chose a GNU license.
Decision: All original LickLab code under **GPL-3.0-or-later** (`LICENSE`,
SPDX id in `package.json`). New source files carry the short GPL header
(see AGENTS.md conventions).
Consequences / compatibility (all compatible with GPL-3.0-or-later):
MIT (React, Tone.js, ireal-reader), Apache-2.0 (Dexie), LGPL-3.0-or-later
(Verovio — combined work stays GPL, keep the linking note in legal.md),
CC0 samples, CC BY 3.0 samples (attribution page required, already planned).
Hard constraint ADDED: **no GPL-2.0-only dependencies** — GPL-2.0-only and
GPL-3.0 are mutually incompatible. This rules out RubberBand (`GPL-2.0-only`)
for M5 time-stretch; use SoundTouch (LGPL, dynamically linked/WASM keeps it
a separate work under LGPL terms) or a non-copyleft engine. ODbL (Weimar DB,
if ever seeded in bulk) stays a separate database-licence question, unaffected
by the code licence.
