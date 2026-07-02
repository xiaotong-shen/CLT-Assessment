import { test, expect } from "@playwright/test";

/**
 * Smoke tests: verify key pages load without crashing.
 * Does not require a running database — tests UI layer only.
 */

test("intake page loads in English", async ({ page }) => {
  await page.goto("/en/intake");
  await expect(page).toHaveTitle(/ESL/i);
  await expect(page.getByRole("button", { name: /start assessment/i })).toBeVisible();
});

test("intake page loads in zh-Hans", async ({ page }) => {
  await page.goto("/zh-Hans/intake");
  // The submit button is visible (text differs by locale, so target it by
  // type rather than name — and to avoid matching dev-only overlay buttons).
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("staff login page loads", async ({ page }) => {
  await page.goto("/en/login");
  // Anchor the name so it matches only the credentials submit button, not the
  // dev-only "Sign in as Dev Admin" bypass button.
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  // Target inputs by type — the labels aren't associated (no htmlFor), so
  // getByLabel doesn't resolve them.
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("queue page redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/en/queue");
  await expect(page).toHaveURL(/login/);
});
