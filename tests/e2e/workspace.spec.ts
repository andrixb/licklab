// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import { test, expect } from "@playwright/test";

test("anonymous opens a shared progression and auditions a starter-pack lick", async ({ page }) => {
  await page.goto("/play?c=Dm7%20G7%20%7C%20Cmaj7%20%7C");
  await expect(page.getByRole("region", { name: "progression workspace" })).toBeVisible();

  // Analyzer finds the ii-V-I segment; starter pack licks appear by tier.
  await expect(page.getByLabel("segment 1")).toContainText("ii-V-I.maj");
  const row = page.getByRole("button", { name: "Audition Chord-Tone Descent" });
  await expect(row).toBeVisible();

  // Audition starts playback (Stop appears); stop returns to idle. Audio is
  // synthesized in a real AudioContext; we assert control state, not sound.
  await row.click();
  await expect(page.getByRole("button", { name: "■ Stop" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "■ Stop" }).click();

  // Place the lick in the solo chorus and play it.
  await page.getByLabel("Place Chord-Tone Descent on bars").click();
  await expect(page.getByLabel("placed licks")).toContainText("Chord-Tone Descent");
});

test("preset chips load chords and are shareable", async ({ page }) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Blues in F (12 bar)" }).click();
  await expect(page.getByLabel("Chords input")).toHaveValue(/F7/);
  await expect(page.url()).toContain("c=F7");
  await expect(page.getByLabel("segment 1")).toContainText("blues.12bar");
});
