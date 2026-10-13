// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// ui/ErrorBoundary: one bad lick (or any render crash) must not take down
// the whole app. Catches the throw, shows a recoverable message, and keeps
// the rest of the UI alive.

import React from "react";
import { btnPrimary, card } from "./primitives.js";

interface Props {
  readonly children: React.ReactNode;
  /** What failed, for the message (e.g. "lick"). */
  readonly label?: string;
  readonly onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[${this.props.label ?? "view"}] crashed:`, error);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={`${card} p-4`} role="alert" aria-label={`${this.props.label ?? "view"} error`}>
        <p className="font-semibold text-danger m-0 mb-1.5">
          This {this.props.label ?? "view"} could not be displayed.
        </p>
        <p className="text-dim text-sm m-0 mb-2.5 break-words">
          {error.message}
        </p>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
