# Architecture

Local-first PWA (Dexie/IndexedDB source of truth) + thin Worker API + D1 synced copy.

```
             ┌─────────────┐
             │     UI      │  React + view-models only
             └──────┬──────┘
                    │ use cases
             ┌──────▼──────┐
             │ Application │  ports + shared schemas + use cases
             └──────┬──────┘
        ┌───────────┼────────────┐
        ▼           ▼            ▼
   ┌─────────┐ ┌────────┐ ┌───────────┐
   │ Domain  │ │Adapters│ │  Worker   │  routing→auth→validate→use case
   └─────────┘ └────────┘ └───────────┘
   pure TS, no            Dexie/D1/Tone/Verovio/MIDI/YouTube/HTTP
   framework imports
```

Dependency rule (lint-enforced, fails CI): `domain <- application <-
adapters/worker/ui`. No cycles. Single exception: `ui/composition.ts`
(composition root) wires adapters to use-case closures for components.
Harmonic matching, transposition, notation run
client-side in domain; Worker stays thin (10 ms CPU budget). Sync: push chunks
+ `GET /api/changes?since=<cursor>`, LWW per record in domain.

Ports: LickRepository, SongRepository, SyncRemote, SessionVerifier,
RateLimiter, AudioEngine/BackingProvider, NotationRenderer, MidiInput,
SongImporter, Exporter, TimeStretchPlayer, YouTubeLoopPlayer, Clock,
IdGenerator. See `src/application/ports.ts` and `docs/domain.md`.
