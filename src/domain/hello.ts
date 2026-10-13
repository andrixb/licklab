// domain: pure TypeScript. No imports from React, Tone, Verovio, Dexie, D1, DOM.
// M0 placeholder proves the layer + tests; real pitch/chord/lick model lands in M1.

export const SCHEMA_VERSION = 1;

export function helloDomain(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error("name must not be empty");
  return `hello ${clean}`;
}

/** Last-write-wins per record (sync rule). Pure + unit-tested. M4 expands to full entities. */
export function lastWriteWins<T extends { updatedAt: string }>(a: T, b: T): T {
  return a.updatedAt >= b.updatedAt ? a : b;
}
