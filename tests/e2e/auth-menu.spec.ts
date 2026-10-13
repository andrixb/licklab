import { test, expect } from "@playwright/test";

test("sign-in menu offers OAuth providers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Continue with GitHub" })).toBeVisible();
});
