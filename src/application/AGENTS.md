# application rules

Use cases depend only on port interfaces (`ports.ts`) + domain. Request/response
schemas defined once here and shared by client SyncRemote and Worker validation.
No adapter, Worker, React, or DOM imports. Every use case gets unit tests;
conflict logic gets property tests.
