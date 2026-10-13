// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { auth, exportLibrary, getSignedInUser, onAuthChange, type SessionUser } from "./composition.js";
import { btn, btnPrimary, errorText } from "./primitives.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

const menuItemBase =
  "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[0.95rem] bg-transparent border-0 " +
  "cursor-pointer focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-50";
const menuItem = `${menuItemBase} text-cream hover:bg-gold hover:text-ink`;
const menuItemDanger = `${menuItemBase} text-danger hover:bg-danger-bg`;

export default function AccountMenu(): React.JSX.Element {
  const [user, setUser] = React.useState<SessionUser | null>(getSignedInUser());
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => onAuthChange(setUser), []);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const item = (labelText: string, action: () => Promise<void>, cls = menuItem) => (
    <button
      type="button"
      role="menuitem"
      className={cls}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        setError(null);
        void action()
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setBusy(false));
      }}
    >
      {labelText}
    </button>
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" className={user ? btn : btnPrimary} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user ? "Account" : "Sign in"}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="account menu"
          className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[250px] flex flex-col gap-1 rounded-xl border border-line bg-surface p-2 shadow-[0_14px_40px_rgb(0_0_0/0.7)]"
        >
          {error && <p className={errorText}>{error}</p>}
          {user ? (
            <>
              <p className="px-3 pb-2 text-dim text-xs break-all border-b border-line">
                {user.name} &lt;{user.email}&gt;
              </p>
              {item("Export library (JSON)", async () => {
                await exportLibrary();
                setOpen(false);
              })}
              {item("Export account data", () => auth.exportAccount())}
              <hr className="border-line my-1" />
              {item("Sign out", () => auth.signOut())}
              {item("Delete account…", async () => {
                setOpen(false);
                setConfirmOpen(true);
              }, menuItemDanger)}
            </>
          ) : (
            <>
              {item("Continue with Google", () => auth.signIn("google"))}
              {item("Continue with GitHub", () => auth.signIn("github"))}
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this account?"
        body="Cloud data (account, sessions, synced licks and songs) is removed permanently. This browser's local licks stay on this device. Export first if unsure."
        confirmLabel="Delete account"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setBusy(true);
          setError(null);
          void auth
            .deleteAccount()
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => {
              setBusy(false);
              setConfirmOpen(false);
            });
        }}
      />
    </div>
  );
}
