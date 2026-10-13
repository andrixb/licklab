// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// ui/composition: the ONLY file in ui/ allowed to import adapters.
// Composition root: wires concrete adapters to application use cases and hands
// components plain use-case closures. Everything else in ui/ imports this
// module (or application/domain) — never adapters directly.

import { DexieLickRepository, LickLabDb } from "../adapters/dexie/licks.js";
import { VerovioRenderer } from "../adapters/notation/verovio.js";
import { deleteLick, listLicks, saveLick, type SaveLickInput } from "../application/licks.js";
import { createLickFromAbc, type AbcLickInput } from "../application/lickInput.js";
import { SEED_LICKS } from "../application/seeds.js";
import type { LickFilter } from "../application/ports.js";
import type { Lick } from "../domain/lick.js";

/** Signed-out local-only mode namespace (attaches to the account on first sign-in). */
export const LOCAL_OWNER = "local";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image: string | null;
}

interface DbHandle {
  db: LickLabDb;
  repo: DexieLickRepository;
}

function openNamespace(namespace: string): DbHandle {
  const db = new LickLabDb(namespace);
  return { db, repo: new DexieLickRepository(db) };
}

const clock = { nowIso: (): string => new Date().toISOString() };
const ids = { next: (): string => crypto.randomUUID() };
const renderer = new VerovioRenderer();

let current = openNamespace(LOCAL_OWNER);
let currentUser: SessionUser | null = null;

/** Move all signed-out local data into the user's namespace (first sign-in). */
async function attachLocalData(userId: string): Promise<void> {
  const local = openNamespace(LOCAL_OWNER);
  const rows = await local.repo.list(LOCAL_OWNER, { includeDeleted: true });
  if (rows.length === 0) return;
  for (const lick of rows) {
    await current.repo.save({ ...lick, ownerId: userId });
    if (lick.deletedAt == null) await local.repo.softDelete(lick.id, LOCAL_OWNER, clock.nowIso());
  }
}

/**
 * Bind storage to a session user (null = signed out). Rebuilds the repository,
 * migrates local-only data on first sign-in, and notifies listeners.
 */
export async function bindUser(user: SessionUser | null): Promise<void> {
  if (user && currentUser?.id !== user.id) {
    current = openNamespace(user.id);
    await attachLocalData(user.id);
  }
  if (!user && currentUser) {
    current = openNamespace(LOCAL_OWNER);
  }
  currentUser = user;
  notifyAuth();
}

export function getSignedInUser(): SessionUser | null {
  return currentUser;
}

const authListeners = new Set<(user: SessionUser | null) => void>();
export function onAuthChange(cb: (user: SessionUser | null) => void): () => void {
  authListeners.add(cb);
  return () => authListeners.delete(cb);
}
function notifyAuth(): void {
  for (const cb of authListeners) cb(currentUser);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = (await res.json()) as { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
  if (!body.ok) throw new Error(body.error.message);
  return body.data;
}

export const auth = {
  async me(): Promise<SessionUser | null> {
    try {
      const data = await fetchJson<{ user: SessionUser }>("/api/me");
      return data.user;
    } catch {
      return null;
    }
  },
  async signIn(provider: "google" | "github"): Promise<void> {
    const { createAuthClient } = await import("better-auth/client");
    const client = createAuthClient({ baseURL: "/api/auth" });
    const result = (await client.signIn.social({ provider, callbackURL: window.location.origin })) as
      | { url?: string; redirect?: boolean; error?: { message?: string } }
      | null;
    if (result?.error) throw new Error(result.error.message ?? "sign-in failed");
    if (!result?.url) throw new Error("provider not configured");
    window.location.href = result.url;
  },
  async signOut(): Promise<void> {
    const { createAuthClient } = await import("better-auth/client");
    const client = createAuthClient({ baseURL: "/api/auth" });
    await client.signOut();
    await bindUser(null);
  },
  async deleteAccount(): Promise<void> {
    await fetchJson("/api/account", { method: "DELETE" });
    await bindUser(null);
  },
  /** Server-side account data (identity + providers) as a downloadable JSON. */
  async exportAccount(): Promise<void> {
    const data = await fetchJson<unknown>("/api/account/export");
    downloadJson("licklab-account-export.json", data);
  },
};

/** Full backup of the current library (all licks incl. tombstones). */
export async function exportLibrary(): Promise<void> {
  const licks = await current.repo.list(currentUser?.id ?? LOCAL_OWNER, { includeDeleted: true });
  downloadJson("licklab-library-export.json", { schemaVersion: 1, exportedAt: clock.nowIso(), licks });
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const lickLab = {
  listLicks: (filter?: LickFilter): Promise<Lick[]> => listLicks({ repo: current.repo }, currentUser?.id ?? LOCAL_OWNER, filter),
  getLick: (id: string) => current.repo.get(id, currentUser?.id ?? LOCAL_OWNER),
  createLick: (input: SaveLickInput): Promise<Lick> => saveLick({ repo: current.repo, clock, ids }, currentUser?.id ?? LOCAL_OWNER, input),
  createLickFromAbc: (input: AbcLickInput): Promise<Lick> => createLickFromAbc({ repo: current.repo, clock, ids }, currentUser?.id ?? LOCAL_OWNER, input),
  removeLick: (id: string): Promise<void> => deleteLick({ repo: current.repo, clock }, currentUser?.id ?? LOCAL_OWNER, id),
  renderNotation: (abc: string, opts?: { title?: string }): Promise<string> => renderer.renderAbcToSvg(abc, opts),
  ensureSeeded: async (): Promise<void> => {
    const owner = currentUser?.id ?? LOCAL_OWNER;
    if ((await current.repo.list(owner)).length > 0) return;
    let n = 0;
    for (const seed of SEED_LICKS) {
      n += 1;
      await saveLick({ repo: current.repo, clock, ids: { next: () => `seed-${n}` } }, owner, seed);
    }
  },
};
