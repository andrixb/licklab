// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { auth, bindUser, lickLab } from "./composition.js";
import { LibraryView } from "./LibraryView.js";
import { LickDetailView } from "./LickDetailView.js";
import { NewLickView } from "./NewLickView.js";
import { btnLink } from "./primitives.js";

const AccountMenu = React.lazy(() => import("./AccountMenu.js"));

type Route = { view: "library" } | { view: "detail"; id: string } | { view: "new" };

export function App(): React.JSX.Element {
  const [route, setRoute] = React.useState<Route>({ view: "library" });
  const [ready, setReady] = React.useState(false);
  const [libraryKey, setLibraryKey] = React.useState(0);

  React.useEffect(() => {
    void (async () => {
      const user = await auth.me();
      if (user) await bindUser(user);
      await lickLab.ensureSeeded().catch((e: unknown) => console.error("seed failed", e));
      setReady(true);
    })();
  }, []);

  const goLibrary = () => {
    setRoute({ view: "library" });
    setLibraryKey((k) => k + 1);
  };

  return (
    <div className="flex-1 w-full max-w-[1100px] mx-auto px-5 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-[18px] pb-3.5 border-b border-line mb-[22px]">
        <h1 className="m-0 text-[1.35rem] font-serif">
          <button type="button" className={`${btnLink} text-gold`} onClick={goLibrary}>
            LickLab <small className="font-sans text-[0.55em] text-dim ml-2 tracking-[0.12em]">jazz licks over standards</small>
          </button>
        </h1>
        <React.Suspense fallback={null}>
          <AccountMenu />
        </React.Suspense>
      </header>
      {!ready ? (
        <p className="py-5 italic text-dim">Loading your lick library…</p>
      ) : route.view === "detail" ? (
        <LickDetailView id={route.id} onBack={goLibrary} />
      ) : route.view === "new" ? (
        <NewLickView onSaved={(id) => setRoute({ view: "detail", id })} onCancel={goLibrary} />
      ) : (
        <LibraryView key={libraryKey} onOpen={(id) => setRoute({ view: "detail", id })} onNew={() => setRoute({ view: "new" })} />
      )}
      <footer className="mt-9 pt-3.5 border-t border-line text-dim text-sm">
        <p>
          Local-first: your licks live in this browser. Scores you import and audio you load never leave this device — only chord
          changes sync to the cloud. Standards playback lives at{" "}
          <a href="https://realbook.site/" rel="noreferrer">
            realbook.site
          </a>{" "}
          (link-out only).
        </p>
      </footer>
    </div>
  );
}
