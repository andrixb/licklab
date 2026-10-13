import { test, expect } from "@playwright/test";

test("create lick via ABC, view notation, transpose, delete", async ({ page }) => {
  const title = `E2E Lick ${Date.now()}`;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LickLab" })).toBeVisible();
  await expect(page.getByLabel("lick library")).toBeVisible();

  await page.getByRole("button", { name: "+ New lick" }).click();
  await page.getByLabel("Title").fill(title);
  // Chord defaults to Dm7, ABC textarea prefilled with a valid line.
  await page.getByRole("button", { name: "Save lick" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  // Notation engine loads lazily (~8MB); allow generous time on first view.
  await expect(page.getByLabel("notation")).toBeVisible({ timeout: 90_000 });

  // Transposition views re-engrave.
  await page.getByRole("button", { name: "for Bb" }).click();
  await expect(page.getByLabel("notation")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Bass clef" }).click();
  await expect(page.getByLabel("notation")).toBeVisible({ timeout: 30_000 });

  // Back to library: searchable, then delete to leave no trace.
  await page.getByRole("button", { name: "← Library" }).click();
  await page.getByLabel("Search licks").fill(title);
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeHidden();
});
