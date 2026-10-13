// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// worker/d1-dialect: minimal Kysely dialect over a D1Database binding.
// Only what better-auth's kysely adapter needs: single-statement queries,
// no interactive transactions (verified: better-auth core + kysely adapter
// contain zero `.transaction(` calls). Schema is managed by our own
// Wrangler D1 migrations, never by an ORM.

import {
  CompiledQuery,
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type QueryResult,
} from "kysely";

export interface D1Like {
  prepare(query: string): {
    bind(...params: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
  /** Only used by better-auth's introspection path, which we disable. */
  batch?(statements: { toString(): string }[]): Promise<unknown[]>;
}

class D1Connection implements DatabaseConnection {
  constructor(private readonly db: D1Like) {}
  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.db.prepare(compiled.sql).bind(...compiled.parameters.map((p) => toD1Param(p)));
    const head = compiled.sql.trimStart().slice(0, 6).toUpperCase();
    const wantsRows = head === "SELECT" || head.startsWith("WITH") || head === "PRAGMA" || /\breturning\b/i.test(compiled.sql);
    if (wantsRows) {
      const { results } = await stmt.all<R>();
      return { rows: fromD1Rows(results ?? []) };
    }
    await stmt.run();
    return { rows: [] };
  }
  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("streaming not supported on D1");
  }
}

/** better-auth passes Dates (and ISO strings); D1 needs primitives. */
function toD1Param(p: unknown): unknown {
  if (p instanceof Date) return p.getTime();
  if (typeof p === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(p)) {
    const ms = Date.parse(p);
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof p === "boolean") return p ? 1 : 0;
  if (typeof p === "bigint") return Number(p);
  return p;
}

/**
 * D1 returns INTEGER millis for our date columns; better-auth core tolerates
 * Date | number | string on read, so no conversion is needed here.
 */
function fromD1Rows<R>(rows: R[]): R[] {
  return rows;
}

class D1Driver extends DummyDriver {
  constructor(private readonly db: D1Like) {
    super();
  }
  async acquireConnection(): Promise<DatabaseConnection> {
    return new D1Connection(this.db);
  }
  async releaseConnection(): Promise<void> {
    // D1 is HTTP-backed; nothing to release.
  }
}

export class D1Dialect implements Dialect {
  constructor(private readonly db: D1Like) {}
  createAdapter(): SqliteAdapter {
    return new SqliteAdapter();
  }
  createDriver(): Driver {
    return new D1Driver(this.db);
  }
  createIntrospector(db: Kysely<unknown>): SqliteIntrospector {
    return new SqliteIntrospector(db);
  }
  createQueryCompiler(): SqliteQueryCompiler {
    return new SqliteQueryCompiler();
  }
}

export function createD1Kysely<T>(db: D1Like): Kysely<T> {
  return new Kysely<T>({ dialect: new D1Dialect(db) });
}
