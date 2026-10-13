// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain: pure TypeScript. No imports from React, Tone, Verovio, Dexie, D1, DOM.
// M0 placeholder (hello/SCHEMA_VERSION) kept for its characterization test.

export const SCHEMA_VERSION = 1;

export function helloDomain(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error("name must not be empty");
  return `hello ${clean}`;
}

/** LWW moved to domain/sync.ts (real rules + property tests); re-exported for compatibility. */
export { lastWriteWins } from "./sync.js";
