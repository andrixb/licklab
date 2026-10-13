# STATUS.md — current state

**Milestone:** M1 complete, deployed (pending your browser check).
**Live:** production `https://licklab.licklab.workers.dev` (redeployed with M1).
**What works:** lick library (search + function filter + delete), ABC entry
(form → validated lick), detail with engraved notation + Concert/Bb/Eb/Bass
views with correct enharmonics, 2 self-written seed licks, PWA shell
(manifest, icons, SW precaches shell / runtime-caches Verovio).
**Tests:** 62 unit/contract/adapter tests pass; coverage 96.6% stmts / 88.2%
branches / 100% funcs (thresholds 90/85/90); e2e (create→notation→transpose→
delete) passes on Chromium; lint + arch rule (39 modules, 0 violations) +
budget (18 files, initial 335/400 KB, Verovio 8 MB lazy) + docs-check green.
**Known issues:** 17 MB Verovio `.map` ships in dist (under limits, slows
deploys — strip or hidden-sourcemap later); preview versions share prod D1
(no writes happen yet); CI secrets are set (pushes to `main` deploy prod,
PRs get version previews); PNG icons are generated placeholders.
**Next:** M2 (song import: MusicXML/iReal/typed + Tone.js band engine).
**Licence:** code now GPL-3.0-or-later (`LICENSE`, ADR-009); M5 time-stretch
must avoid RubberBand (GPL-2.0-only, incompatible).

Cold-start: read `AGENTS.md`, then this file, then `docs/`.
