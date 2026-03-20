import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify critical pages load without crashing.
 * These run against the live dev server and don't require authentication.
 */

test.describe("Public pages load correctly", () => {
  test("landing page loads without server error", async ({ page }) => {
    const res = await page.goto("/");
    // Should not be a server error
    expect(res?.status()).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/500|Error/i);
    // Title should be set correctly
    await expect(page).toHaveTitle(/Budo League/i);
  });

  test("landing page has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Budo League/i);
  });

  test("landing page shows league branding", async ({ page }) => {
    await page.goto("/");
    // Should have the league logo
    const logo = page.locator('img[alt*="Budo"]');
    await expect(logo.first()).toBeVisible({ timeout: 15_000 });
  });

  test("landing page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical errors (e.g., favicon 404, analytics)
    const critical = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("analytics") &&
        !e.includes("ERR_CONNECTION_REFUSED") &&
        !e.includes("ERR_SOCKET_NOT_CONNECTED") // Network flakes in dev
    );
    expect(critical).toEqual([]);
  });
});

test.describe("API routes respond", () => {
  test("GET /api/teams returns 200", async ({ request }) => {
    const res = await request.get("/api/teams");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.teams).toBeDefined();
    expect(Array.isArray(body.teams)).toBe(true);
  });

  test("GET /api/gameweeks/current returns 200", async ({ request }) => {
    const res = await request.get("/api/gameweeks/current");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("current");
    expect(body).toHaveProperty("all");
  });

  test("GET /api/standings returns 200", async ({ request }) => {
    const res = await request.get("/api/standings");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("rows");
    expect(Array.isArray(body.rows)).toBe(true);
  });

  test("GET /api/players returns 200", async ({ request }) => {
    const res = await request.get("/api/players");
    expect(res.status()).toBe(200);
  });

  test("GET /api/chips returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/chips");
    expect(res.status()).toBe(401);
  });

  test("GET /api/transfers returns 401 without auth", async ({ request }) => {
    const res = await request.get("/api/transfers?gw_id=1");
    expect(res.status()).toBe(401);
  });

  test("POST /api/rosters/save returns 401 without auth", async ({ request }) => {
    const res = await request.post("/api/rosters/save", {
      data: { gameweekId: 1, squadIds: ["a"] },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Error pages", () => {
  test("404 page renders for unknown routes", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    // Next.js returns 404 for unknown pages
    expect(res?.status()).toBe(404);
  });
});
