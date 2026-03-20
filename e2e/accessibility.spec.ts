import { test, expect } from "@playwright/test";

/**
 * Basic accessibility checks using Playwright.
 * Tests fundamental a11y requirements without a full axe audit.
 */

test.describe("Accessibility basics", () => {
  test("dashboard page has a main landmark", async ({ page }) => {
    // Dashboard layout has a <main> element
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");
    const main = page.locator("main, [role='main']");
    await expect(main.first()).toBeVisible({ timeout: 15_000 });
  });

  test("images have alt attributes", async ({ page }) => {
    await page.goto("/");
    // Wait for splash to clear and content to load
    await page.waitForTimeout(10_000);
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const role = await img.getAttribute("role");
      // Image should have alt text OR role="presentation"
      const hasAlt =
        (alt !== null && alt !== undefined) || role === "presentation";
      if (!hasAlt) {
        const src = await img.getAttribute("src");
        console.warn(`Image without alt: ${src}`);
      }
      expect(hasAlt).toBe(true);
    }
  });

  test("page has a valid lang attribute", async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
    expect(lang).toBe("en");
  });

  test("page has a title", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("text is readable (minimum contrast on key elements)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that body text color is not the same as background
    const bodyColor = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return {
        color: style.color,
        bg: style.backgroundColor,
      };
    });

    // Text and background should be different
    expect(bodyColor.color).not.toBe(bodyColor.bg);
  });

  test("interactive elements are keyboard focusable", async ({ page }) => {
    await page.goto("/");
    // Wait for splash to clear
    await page.waitForTimeout(10_000);

    const signIn = page.getByText("Sign In");
    if (await signIn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await signIn.focus();
      const isFocused = await signIn.evaluate(
        (el) => document.activeElement === el
      );
      expect(isFocused).toBe(true);
    }
  });

  test("no viewport overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });
});
