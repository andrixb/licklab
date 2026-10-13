// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// ui/router: tiny path router over history.pushState (SPA fallback is
// configured in wrangler assets). No view logic here — App maps Route to a
// screen. Shared links encode the progression in the query string ONLY
// (stateless: nothing stored server-side).

export type Route =
  | { view: "library" }
  | { view: "detail"; id: string }
  | { view: "new" }
  | { view: "play"; preset?: string; chords?: string }
  | { view: "attribution" };

export function parseRoute(pathname: string, search: string): Route {
  if (pathname.startsWith("/lick/")) return { view: "detail", id: decodeURIComponent(pathname.slice("/lick/".length)) };
  if (pathname === "/new") return { view: "new" };
  if (pathname === "/play") {
    const q = new URLSearchParams(search);
    const preset = q.get("preset");
    const chords = q.get("c");
    return {
      view: "play",
      ...(preset ? { preset } : {}),
      ...(chords ? { chords } : {}),
    };
  }
  if (pathname === "/attribution") return { view: "attribution" };
  return { view: "library" };
}

export function routeToUrl(r: Route): string {
  switch (r.view) {
    case "library":
      return "/";
    case "new":
      return "/new";
    case "detail":
      return `/lick/${encodeURIComponent(r.id)}`;
    case "play": {
      const q = new URLSearchParams();
      if (r.preset) q.set("preset", r.preset);
      if (r.chords) q.set("c", r.chords);
      const s = q.toString();
      return s ? `/play?${s}` : "/play";
    }
    case "attribution":
      return "/attribution";
  }
}

export function navigate(r: Route): void {
  window.history.pushState({}, "", routeToUrl(r));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Shareable link for typed chords (the spec's stateless progression share). */
export function shareUrlForChords(chords: string): string {
  return `${window.location.origin}${routeToUrl({ view: "play", chords })}`;
}
