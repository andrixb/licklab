// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { auth, bindUser, lickLab } from "./composition.js";
import { AttributionPage } from "./AttributionPage.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { LibraryView } from "./LibraryView.js";
import { LickDetailView } from "./LickDetailView.js";
import { NewLickView } from "./NewLickView.js";
import { parseRoute, navigate, type Route } from "./router.js";
import { btnGhost, btnLink } from "./primitives.js";

const AccountMenu = React.lazy(() => import("./AccountMenu.js"));
const WorkspaceView = React.lazy(() => import("./WorkspaceView.js").then((m) => ({ default: m.WorkspaceView })));

function currentRoute(): Route {
  return parseRoute(window.location.pathname, window.location.search);
}

export function App(): React.JSX.Element {
  const [route, setRoute] = React.useState<Route>(currentRoute);
  const [ready, setReady] = React.useState(false);
  const [libraryKey, setLibraryKey] = React.useState(0);

  React.useEffect(() => {
    void (async () => {
      const user = await auth.me();
      if (user) await bindUser(user);
      await lickLab.ensureSeeded().catch((e: unknown) => console.error("seed failed", e));
      setReady(true);
    })();
    const onPop = (): void => setRoute(currentRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (r: Route): void => {
    navigate(r);
    if (r.view === "library") setLibraryKey((k) => k + 1);
  };

  return (
    <div className="flex-1 w-full max-w-[1100px] mx-auto px-5 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-[18px] pb-3.5 border-b border-line mb-[22px]">
        <h1 className="m-0 text-[1.35rem] font-serif">
          <button type="button" className={`${btnLink} text-gold`} onClick={() => go({ view: "library" })}>
            LickLab <small className="font-sans text-[0.55em] text-dim ml-2 tracking-[0.12em]">jazz licks over standards</small>
          </button>
        </h1>
        <nav className="flex gap-1" aria-label="main">
          <button type="button" className={`${btnGhost} ${route.view === "library" ? "text-gold" : ""}`} onClick={() => go({ view: "library" })}>
            Library
          </button>
          <button type="button" className={`${btnGhost} ${route.view === "play" ? "text-gold" : ""}`} onClick={() => go({ view: "play" })}>
            Play over…
          </button>
        </nav>
        <React.Suspense fallback={null}>
          <AccountMenu />
        </React.Suspense>
      </header>
      {!ready ? (
        <p className="py-5 italic text-dim">Loading your lick library…</p>
      ) : route.view === "detail" ? (
        <ErrorBoundary label="lick">
          <LickDetailView id={route.id} onBack={() => go({ view: "library" })} />
        </ErrorBoundary>
      ) : route.view === "new" ? (
        <NewLickView onSaved={(id) => go({ view: "detail", id })} onCancel={() => go({ view: "library" })} />
      ) : route.view === "play" ? (
        <React.Suspense fallback={<p className="py-5 italic text-dim">Loading workspace…</p>}>
          <WorkspaceView key={`${route.preset ?? ""}|${route.chords ?? ""}`} seed={route} />
        </React.Suspense>
      ) : route.view === "attribution" ? (
        <AttributionPage />
      ) : (
        <LibraryView key={libraryKey} onOpen={(id) => go({ view: "detail", id })} onNew={() => go({ view: "new" })} />
      )}
      <footer className="mt-9 pt-3.5 border-t border-line text-dim text-sm">
        <p>
          Your private licks stay local-first; publish one and it goes to the community catalog. Imported scores and audio you load never
          leave this device. Standards playback lives at{" "}
          <a href="https://realbook.site/" rel="noreferrer">
            realbook.site
          </a>{" "}
          (link-out only).{" "}
          <a href="/attribution" className={btnLink} style={{ marginLeft: "1rem" }}>
            Sample Attributions
          </a>{" "}
          <span title="Deployed build — tells a stale practice tab apart at a glance">build {__BUILD_ID__}</span>
        </p>
      </footer>
    </div>
  );
}
