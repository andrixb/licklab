import React from "react";
import { checkHealth } from "../application/health.js";

export function App(): React.JSX.Element {
  const health = checkHealth({ clock: { nowIso: () => new Date().toISOString() } });
  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
      <h1>LickLab</h1>
      <p>Store jazz licks and try them over real standards. (M0 skeleton — local-first, offline-capable PWA coming in M1+.)</p>
      <p>
        API health: <code>{JSON.stringify(health)}</code>
      </p>
      <p>
        Your charts stay yours: only chord changes + metadata sync to the cloud; scores and audio never leave this device. See{" "}
        <a href="https://realbook.site/" rel="noreferrer">
          realbook.site
        </a>{" "}
        for standards playback (link-out only — no scraping).
      </p>
    </main>
  );
}
