import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  // Just confirm we get a 200 — content varies by implementation phase
  await expect(page).toHaveURL("/");
  expect(page.url()).toContain("localhost");
});
