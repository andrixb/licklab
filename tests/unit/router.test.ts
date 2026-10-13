// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { describe, expect, it } from "vitest";
import { parseRoute, routeToUrl } from "../../src/ui/router.js";
import * as fc from "fast-check";

describe("ui/router", () => {
  it("parses the known screens", () => {
    expect(parseRoute("/", "")).toEqual({ view: "library" });
    expect(parseRoute("/new", "")).toEqual({ view: "new" });
    expect(parseRoute("/lick/abc%201", "")).toEqual({ view: "detail", id: "abc 1" });
    expect(parseRoute("/play", "")).toEqual({ view: "play" });
    expect(parseRoute("/play", "?preset=blues-f")).toEqual({ view: "play", preset: "blues-f" });
    expect(parseRoute("/play", "?c=Dm7%20G7%20%7C%20Cmaj7")).toEqual({ view: "play", chords: "Dm7 G7 | Cmaj7" });
    expect(parseRoute("/anything-else", "")).toEqual({ view: "library" });
  });
  it("the ?e=e query is ignored (verified platform noise)", () => {
    expect(parseRoute("/", "?e=e")).toEqual({ view: "library" });
  });
  it("property: routeToUrl then parseRoute round-trips", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ view: "library" } as const),
          fc.constant({ view: "new" } as const),
          fc.string({ minLength: 1, maxLength: 30 }).map((id) => ({ view: "detail" as const, id })),
          fc.string({ minLength: 1, maxLength: 40 }).map((c) => ({ view: "play" as const, chords: c })),
        ),
        (r) => {
          const url = routeToUrl(r);
          const qIdx = url.indexOf("?");
          const parsed = parseRoute(qIdx < 0 ? url : url.slice(0, qIdx), qIdx < 0 ? "" : url.slice(qIdx));
          expect(parsed).toEqual(r);
        },
      ),
    );
  });
});
