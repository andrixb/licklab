// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { btnDanger, btnGhost, dialog, dialogActions, dialogBody, dialogTitle } from "./primitives.js";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/** Native <dialog> — accessible without a component library. */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose }: ConfirmDialogProps): React.JSX.Element {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={dialog}
      onClose={onClose}
      aria-label={title}
    >
      <h2 className={dialogTitle}>{title}</h2>
      <p className={dialogBody}>{body}</p>
      <div className={dialogActions}>
        <button type="button" className={btnGhost} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnDanger} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
