# ui rules

React components + view-models only. No business logic (that lives in domain/
use cases). Talk to use cases, never to adapters directly. The single exception
is `composition.ts` (composition root, lint-excepted): it wires Dexie/Verovio
adapters to use-case closures; every other file imports composition, application
or domain only. Mobile-friendly, large touch targets (at the instrument).
Mock audio/MIDI in e2e tests.
