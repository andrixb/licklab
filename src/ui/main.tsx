// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./theme.css";

const el = document.getElementById("root");
if (!el) throw new Error("#root missing");
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
