// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// The asset CSP in public/_headers must permit everything the app actually
// loads. Each regression below cost a real "action has been blocked" round:
//   - worker-src blob:  Tone's internal timing worker (play/audition silent)
//   - font-src data:    Verovio embeds its music glyph font as a data: URI inside
//                       the SVG it injects (notation invisible)
//   - img/connect:      starter-pack + catalog fetches; media blob: for audio.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Parse "/*" CSP rule out of the Netlify-style _headers file. */
function cspOf(headers: string): Record<string, string[]> {
  const line = headers
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("Content-Security-Policy:"));
  if (!line) throw new Error("no Content-Security-Policy in public/_headers");
  const value = line.slice("Content-Security-Policy:".length).replace(/;$/, "").split(";");
  const out: Record<string, string[]> = {};
  for (const part of value) {
    const [name, ...rest] = part.trim().split(/\s+/);
    if (name) out[name] = rest;
  }
  return out;
}

describe("asset CSP (public/_headers)", () => {
  const csp = cspOf(readFileSync(join(resolve(process.cwd()), "public/_headers"), "utf8"));

  it("stays tight by default", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
  });

  it("allows what the app demonstrably loads", () => {
    expect(csp["script-src"]).toContain("'self'");
    expect(csp["worker-src"], "Tone timing worker (blob:)").toEqual(expect.arrayContaining(["'self'", "blob:"]));
    expect(csp["font-src"], "Verovio glyph font (data:)").toEqual(expect.arrayContaining(["'self'", "data:"]));
    expect(csp["img-src"], "starter-pack covers (data:/blob:)").toEqual(expect.arrayContaining(["'self'", "data:", "blob:"]));
    expect(csp["media-src"], "buffers/sample playback").toEqual(expect.arrayContaining(["'self'", "blob:"]));
    expect(csp["connect-src"]).toContain("'self'");
    expect(csp["frame-src"], "YouTube IFrame loops (nocookie first)").toEqual(
      expect.arrayContaining(["https://www.youtube-nocookie.com", "https://www.youtube.com"]),
    );
  });
});
