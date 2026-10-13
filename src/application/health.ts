// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application: use cases depend only on port interfaces + shared schemas.
// M0 placeholder: health check + shared response envelope used by client and Worker.

export interface HealthResponse {
  ok: true;
  version: string;
  schemaVersion: number;
}

export interface Clock {
  nowIso(): string;
}

/** Port: every use case receives dependencies via ports, never concrete adapters. */
export interface HealthCheckDeps {
  clock: Clock;
}

export function checkHealth(deps: HealthCheckDeps): HealthResponse {
  void deps;
  return { ok: true, version: "0.0.1", schemaVersion: 1 };
}

/** Shared API envelope: defined once here, used by client SyncRemote and Worker. */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
