// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { abcToSaveInput, createLickFromAbc, LickInputError } from "./lickInput.js";
import type { AbcLickInput } from "./lickInput.js";
import type { Lick } from "../domain/lick.js";
import type { LickRepository } from "./ports.js";

function fakeRepo() {
  const store = new Map<string, Lick>();
  const repo: LickRepository = {
    async save(lick) {
      store.set(`${lick.ownerId}:${lick.id}`, lick);
    },
    async get(id, ownerId) {
      return store.get(`${ownerId}:${id}`) ?? null;
    },
    async list(ownerId) {
      return [...store.values()].filter((l) => l.ownerId === ownerId && !l.deletedAt);
    },
    async softDelete() {
      /* not used here */
    },
  };
  return { repo, store };
}

const base: AbcLickInput = {
  title: "T",
  abc: "X:1\nL:1/8\nK:C\nD E F G A2 |",
  chord: "Dm7",
  originalKey: "C",
  function: "ii-V-I major",
  artist: "Me",
  tags: ["a, b"],
  difficulty: 2,
};

describe("abcToSaveInput", () => {
  it("parses ABC into a pattern relative to the chord root", () => {
    const input = abcToSaveInput(base);
    expect(input.pattern.length).toBe(5);
    expect(input.harmonicContext.chords[0]?.symbol).toBe("Dm7");
    expect(input.tags).toEqual(["a", "b"]);
  });
  it("reports friendly errors for bad chord/ABC/empty", () => {
    expect(() => abcToSaveInput({ ...base, chord: "H7" })).toThrow(LickInputError);
    expect(() => abcToSaveInput({ ...base, abc: "X:1\nK:C\n" })).toThrow(LickInputError);
    expect(() => abcToSaveInput({ ...base, abc: "X:1\nK:C\nzzz |" })).toThrow(LickInputError);
  });
});

describe("createLickFromAbc", () => {
  it("saves through the repository port", async () => {
    const { repo, store } = fakeRepo();
    const deps = { repo, clock: { nowIso: () => "2026-04-01T00:00:00.000Z" }, ids: { next: () => "l1" } };
    const lick = await createLickFromAbc(deps, "u1", { ...base, tags: ["x", "y"] });
    expect(lick.id).toBe("l1");
    expect(lick.ownerId).toBe("u1");
    expect(lick.title).toBe("T");
    expect([...store.keys()]).toEqual(["u1:l1"]);
  });
});
