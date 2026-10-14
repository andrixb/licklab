// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.js";
import { noteAppUpdateReady } from "./composition.js";
import "./theme.css";

// A newer build installing in the background must eventually reach this tab:
// without a reload a long-lived practice session keeps running pruned chunks.
// Reloads only ever happen between playbacks, never mid-chorus.
registerSW({ immediate: true, onNeedRefresh: () => noteAppUpdateReady() });

const el = document.getElementById("root");
if (!el) throw new Error("#root missing");
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
