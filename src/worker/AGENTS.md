# worker rules

Thin driving adapter: routing → session/auth check → validate with shared
application schema → call use case → JSON. No business logic, no heavy compute
(no matching/transposition/notation). `ownerId` from session only. Every route
needs API tests (auth, expired session, validation, statement-count) + cross-user
tests. Keep chunks well under 50 statements / 100 bound params.
