// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { helloDomain, lastWriteWins } from "./hello.js";

describe("helloDomain", () => {
  it("greets a trimmed name", () => {
    expect(helloDomain("  bird  ")).toBe("hello bird");
  });
  it("rejects empty", () => {
    expect(() => helloDomain("   ")).toThrow();
  });
  it("property: never returns empty for non-empty input", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), (s) => {
        expect(helloDomain(s).length).toBeGreaterThan("hello ".length);
      }),
    );
  });
});

describe("lastWriteWins", () => {
  it("picks the later record; ties keep local", () => {
    const a = { updatedAt: "2026-01-01T00:00:00.000Z" };
    const b = { updatedAt: "2026-01-02T00:00:00.000Z" };
    expect(lastWriteWins(a, b)).toBe(b);
    expect(lastWriteWins(b, a)).toBe(b);
    expect(lastWriteWins(a, { ...a })).toBe(a);
  });
  it("property: convergence regardless of order", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (t1, t2) => {
        const a = { updatedAt: t1 };
        const b = { updatedAt: t2 };
        expect(lastWriteWins(a, b)).toEqual(lastWriteWins(b, a));
      }),
    );
  });
});
