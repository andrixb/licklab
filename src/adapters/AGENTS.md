# adapters rules

One folder per adapter (dexie, d1, tone, verovio, midi, importers, exporters,
youtube, http-sync). Each implements an application port; replaceable without
touching domain/use cases. Contract-test every port against fake + real
(fake-indexeddb, workerd D1, Tone.Offline). Imported scores/audio never leave
the browser — adapters must not upload them.
