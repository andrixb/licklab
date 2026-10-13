import React from "react";
import { lickLab } from "./composition.js";
import { LibraryView } from "./LibraryView.js";
import { LickDetailView } from "./LickDetailView.js";
import { NewLickView } from "./NewLickView.js";

type Route = { view: "library" } | { view: "detail"; id: string } | { view: "new" };

export function App(): React.JSX.Element {
  const [route, setRoute] = React.useState<Route>({ view: "library" });
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    lickLab
      .ensureSeeded()
      .catch((e: unknown) => console.error("seed failed", e))
      .finally(() => setReady(true));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900 }}>
      <h1>LickLab</h1>
      {!ready ? (
        <p>Loading your lick library…</p>
      ) : route.view === "detail" ? (
        <LickDetailView id={route.id} onBack={() => setRoute({ view: "library" })} />
      ) : route.view === "new" ? (
        <NewLickView onSaved={(id) => setRoute({ view: "detail", id })} onCancel={() => setRoute({ view: "library" })} />
      ) : (
        <LibraryView onOpen={(id) => setRoute({ view: "detail", id })} onNew={() => setRoute({ view: "new" })} />
      )}
      <footer style={{ marginTop: 32 }}>
        <p>
          Local-first: your licks live in this browser. Scores you import and audio you load never leave this device — only chord
          changes sync to the cloud (M4). Standards playback lives at{" "}
          <a href="https://realbook.site/" rel="noreferrer">
            realbook.site
          </a>{" "}
          (link-out only).
        </p>
      </footer>
    </main>
  );
}
