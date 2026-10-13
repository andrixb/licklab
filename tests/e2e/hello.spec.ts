import { test, expect } from "@playwright/test";

test("hello world renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LickLab" })).toBeVisible();
  await expect(page.getByText("Store jazz licks")).toBeVisible();
});
