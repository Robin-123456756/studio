import { test, expect } from "@playwright/test";

/**
 * Navigation and public content tests.
 * Tests pages that are viewable without authentication.
 */

test.describe("Landing page navigation", () => {
  test("landing page loads without server error", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(500);
    await expect(page).toHaveTitle(/Budo League/i);
  });

  test("page has no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto("/");
    // Wait for splash to clear
    await page.waitForTimeout(10_000);
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
  });
});

test.describe("API data integrity", () => {
  test("teams have required fields", async ({ request }) => {
    const res = await request.get("/api/teams");
    const { teams } = await res.json();

    if (teams.length > 0) {
      const team = teams[0];
      expect(team).toHaveProperty("team_uuid");
      expect(team).toHaveProperty("name");
      expect(typeof team.name).toBe("string");
    }
  });

  test("standings rows have correct shape", async ({ request }) => {
    const res = await request.get("/api/standings");
    const { rows } = await res.json();

    if (rows.length > 0) {
      const row = rows[0];
      // Verify standings formula fields exist
      expect(row).toHaveProperty("teamId");
      expect(row).toHaveProperty("name");
      expect(row).toHaveProperty("PL");
      expect(row).toHaveProperty("W");
      expect(row).toHaveProperty("D");
      expect(row).toHaveProperty("L");
      expect(row).toHaveProperty("GF");
      expect(row).toHaveProperty("GA");
      expect(row).toHaveProperty("GD");
      expect(row).toHaveProperty("LP");
      expect(row).toHaveProperty("Pts");

      // Verify Pts = W*3 + D
      expect(row.Pts).toBe(row.W * 3 + row.D);

      // Verify GD = GF - GA
      expect(row.GD).toBe(row.GF - row.GA);

      // Verify PL = W + D + L
      expect(row.PL).toBe(row.W + row.D + row.L);
    }
  });

  test("standings are sorted correctly (Pts desc, GD desc)", async ({
    request,
  }) => {
    const res = await request.get("/api/standings");
    const { rows } = await res.json();

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];

      // Must be sorted by Pts DESC
      if (prev.Pts !== curr.Pts) {
        expect(prev.Pts).toBeGreaterThan(curr.Pts);
      } else if (prev.GD !== curr.GD) {
        // Then by GD DESC
        expect(prev.GD).toBeGreaterThanOrEqual(curr.GD);
      }
    }
  });

  test("gameweeks have current and all fields", async ({ request }) => {
    const res = await request.get("/api/gameweeks/current");
    const body = await res.json();

    expect(body).toHaveProperty("current");
    expect(body).toHaveProperty("next");
    expect(body).toHaveProperty("all");
    expect(Array.isArray(body.all)).toBe(true);

    // Each GW in all[] should have hasPlayedMatches boolean
    if (body.all.length > 0) {
      expect(body.all[0]).toHaveProperty("hasPlayedMatches");
      expect(typeof body.all[0].hasPlayedMatches).toBe("boolean");
    }
  });
});

test.describe("Performance basics", () => {
  test("landing page loads within 10 seconds (DOM ready)", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });

  test("API responses are fast (< 3s)", async ({ request }) => {
    const start = Date.now();
    await request.get("/api/teams");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3_000);
  });
});

test.describe("Security headers", () => {
  test("API routes do not expose server internals on error", async ({
    request,
  }) => {
    // Hit an auth-protected route without auth
    const res = await request.get("/api/chips");
    const body = await res.json();

    // Should have a user-friendly error, not a stack trace
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe("string");
    // Should NOT contain internal details
    expect(body.error).not.toMatch(/supabase|postgres|sql|stack|trace/i);
  });
});
