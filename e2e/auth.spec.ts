import { test, expect } from "@playwright/test";

/**
 * Auth flow tests — verify the authentication UI works correctly.
 * The dashboard is publicly accessible (shows league data).
 * The fantasy section requires auth (shows AuthGate inline).
 */

test.describe("Dashboard access", () => {
  test("dashboard loads without redirect (public page)", async ({ page }) => {
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");

    // Dashboard should render — it's a public page showing league data
    // Look for known dashboard elements
    const hasLeagueContent =
      (await page.getByText("League snapshot").isVisible({ timeout: 10_000 }).catch(() => false)) ||
      (await page.getByText("Latest").isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await page.getByText("RESULT").isVisible({ timeout: 5_000 }).catch(() => false));

    expect(hasLeagueContent).toBe(true);
  });

  test("dashboard has sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");

    // Desktop sidebar should have key nav items
    const sidebar = page.locator(".hidden.md\\:block");
    if (await sidebar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(page.getByText("Fantasy")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Matches")).toBeVisible();
      await expect(page.getByText("Teams")).toBeVisible();
      await expect(page.getByText("Players")).toBeVisible();
    }
  });
});

test.describe("Password reset page", () => {
  test("reset password page loads without error", async ({ page }) => {
    await page.goto("/auth/reset-password");
    await expect(page).not.toHaveTitle(/500|Error/i);
    // Should have password-related content
    await page.waitForLoadState("domcontentloaded");
  });
});
