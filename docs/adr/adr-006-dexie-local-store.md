# ADR-006: Dexie as the local-first store (one DB per namespace)

Status: Accepted (M1).
Context: App must be fully usable offline at the instrument; Dexie is UI source
of truth, D1 the synced copy (M4). Shared devices must not mix accounts.
Decision: Dexie via `LickLabDb(namespace)` (`licklab-<namespace>`), compound
key `[ownerId+id]`, owner-first queries (mirrors the D1 index rule). Signed-out
namespace is `"local"`; M4 attaches namespaces to accounts on first sign-in.
Pattern/context stored as full-Lick JSON + normalized filter columns
(function, artist, difficulty) + tombstones. Contract tests run the same suite
vs. memory fake and Dexie (fake-indexeddb).
Consequences: schema v1; migrations for IndexedDB land with entity changes.
