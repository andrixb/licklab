// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/licks: lick use cases. Ports only — no adapters, no UI.
// Timestamps/ids come from injected Clock/IdGenerator (testable, no wall clock).

import { LICK_SCHEMA_VERSION, parseLick, type Lick } from "../domain/lick.js";
import type { Clock, IdGenerator, LickFilter, LickRepository } from "./ports.js";

export interface SaveLickInput {
  readonly title: string;
  readonly pattern: Lick["pattern"];
  readonly harmonicContext: Lick["harmonicContext"];
  readonly source?: Partial<Lick["source"]>;
  readonly tags?: readonly string[];
  readonly difficulty?: Lick["difficulty"];
  readonly notes?: string;
  readonly visibility?: Lick["visibility"];
  readonly license?: string;
}

export interface SaveLickDeps {
  readonly repo: LickRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const EMPTY_SOURCE: Lick["source"] = {
  artist: "",
  instrument: "",
  track: "",
  album: "",
  year: null,
  recordingUrl: "",
  timestampSeconds: null,
  location: "",
};

export async function saveLick(deps: SaveLickDeps, ownerId: string, input: SaveLickInput): Promise<Lick> {
  if (!ownerId) throw new Error("ownerId required");
  const now = deps.clock.nowIso();
  const lick = parseLick({
    id: deps.ids.next(),
    title: input.title,
    pattern: input.pattern,
    harmonicContext: input.harmonicContext,
    source: { ...EMPTY_SOURCE, ...input.source },
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? 3,
    notes: input.notes ?? "",
    visibility: input.visibility ?? "private",
    license: input.license,
    ownerId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    schemaVersion: LICK_SCHEMA_VERSION,
  });
  await deps.repo.save(lick);
  return lick;
}

export interface ListLicksDeps {
  readonly repo: LickRepository;
}

export function listLicks(deps: ListLicksDeps, ownerId: string, filter?: LickFilter): Promise<Lick[]> {
  return deps.repo.list(ownerId, { ...filter, includeDeleted: false });
}

export interface DeleteLickDeps {
  readonly repo: LickRepository;
  readonly clock: Clock;
}

export async function deleteLick(deps: DeleteLickDeps, ownerId: string, id: string): Promise<void> {
  const existing = await deps.repo.get(id, ownerId);
  if (!existing) throw new Error("lick not found");
  await deps.repo.softDelete(id, ownerId, deps.clock.nowIso());
}
