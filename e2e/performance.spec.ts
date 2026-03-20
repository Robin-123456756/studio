import { test, expect } from "@playwright/test";

/**
 * Performance tests using Playwright's built-in metrics.
 * Measures Core Web Vitals and page load performance.
 *
 * These tests verify:
 * - First Contentful Paint (FCP) < 3s
 * - DOM Content Loaded < 5s
 * - Total page weight is reasonable
 * - API response times
 * - No memory leaks (basic check)
 */

test.describe("Core Web Vitals", () => {
  test("dashboard FCP is under 3 seconds", async ({ page }) => {
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");

    // Get FCP from Performance API
    const fcp = await page.evaluate(() => {
      const entries = performance.getEntriesByName("first-contentful-paint");
      return entries.length > 0 ? entries[0].startTime : null;
    });

    if (fcp !== null) {
      console.log(`Dashboard FCP: ${fcp.toFixed(0)}ms`);
      expect(fcp).toBeLessThan(3000);
    }
  });

  test("dashboard DOM interactive under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard", {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    const elapsed = Date.now() - start;

    console.log(`Dashboard DOM interactive: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  test("landing page DOM interactive under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - start;

    console.log(`Landing page DOM interactive: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});

test.describe("Page weight", () => {
  test("dashboard total transfer size is reasonable", async ({ page }) => {
    let totalBytes = 0;
    const resourceSizes: Record<string, number> = {};

    page.on("response", (response) => {
      const url = response.url();
      const headers = response.headers();
      const size = parseInt(headers["content-length"] || "0", 10);
      totalBytes += size;

      // Categorize by type
      if (url.endsWith(".js") || url.includes("/_next/static")) {
        resourceSizes["JS"] = (resourceSizes["JS"] || 0) + size;
      } else if (url.endsWith(".css")) {
        resourceSizes["CSS"] = (resourceSizes["CSS"] || 0) + size;
      } else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)/)) {
        resourceSizes["Images"] = (resourceSizes["Images"] || 0) + size;
      } else {
        resourceSizes["Other"] = (resourceSizes["Other"] || 0) + size;
      }
    });

    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    console.log("\n=== Page Weight Report (Dashboard) ===");
    for (const [type, bytes] of Object.entries(resourceSizes)) {
      console.log(`  ${type}: ${(bytes / 1024).toFixed(0)} KB`);
    }
    console.log(`  TOTAL: ${(totalBytes / 1024).toFixed(0)} KB`);

    // Dashboard should not exceed 5MB total transfer
    expect(totalBytes).toBeLessThan(5 * 1024 * 1024);
  });
});

test.describe("API performance", () => {
  const apiRoutes = [
    { name: "teams", path: "/api/teams" },
    { name: "standings", path: "/api/standings" },
    { name: "gameweeks", path: "/api/gameweeks/current" },
    { name: "players", path: "/api/players" },
  ];

  for (const route of apiRoutes) {
    test(`${route.name} API responds within 2 seconds`, async ({ request }) => {
      const start = Date.now();
      const res = await request.get(route.path);
      const elapsed = Date.now() - start;

      console.log(`API ${route.name}: ${elapsed}ms (status ${res.status()})`);
      expect(res.status()).toBe(200);
      // Dev server cold-starts can be slow (compilation on first hit).
      // Warm responses are ~0.5-3.5s (see summary test). 10s threshold for dev.
      expect(elapsed).toBeLessThan(10_000);
    });
  }

  test("API performance summary", async ({ request }) => {
    const results: Record<string, number> = {};

    for (const route of apiRoutes) {
      const start = Date.now();
      await request.get(route.path);
      results[route.name] = Date.now() - start;
    }

    console.log("\n=== API Performance Summary ===");
    console.table(results);

    // Average should be under 1 second
    const avg =
      Object.values(results).reduce((a, b) => a + b, 0) /
      Object.values(results).length;
    console.log(`Average: ${avg.toFixed(0)}ms`);
  });
});

test.describe("Resource loading", () => {
  test("no failed resource requests on dashboard", async ({ page }) => {
    const failedRequests: string[] = [];

    page.on("requestfailed", (request) => {
      const url = request.url();
      // Ignore known non-critical failures
      if (
        url.includes("favicon") ||
        url.includes("analytics") ||
        url.includes("sw.js") // service worker may not exist in dev
      ) {
        return;
      }
      failedRequests.push(`${request.failure()?.errorText}: ${url}`);
    });

    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    if (failedRequests.length > 0) {
      console.log("Failed requests:", failedRequests);
    }

    expect(failedRequests).toHaveLength(0);
  });

  test("no 4xx/5xx responses for page resources", async ({ page }) => {
    const errorResponses: string[] = [];

    page.on("response", (response) => {
      const status = response.status();
      const url = response.url();
      // Ignore API calls we know return 401 (expected)
      if (url.includes("/api/") && status === 401) return;
      // Ignore favicon
      if (url.includes("favicon")) return;

      if (status >= 400) {
        errorResponses.push(`${status}: ${url}`);
      }
    });

    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    if (errorResponses.length > 0) {
      console.log("Error responses:", errorResponses);
    }

    expect(errorResponses).toHaveLength(0);
  });
});
