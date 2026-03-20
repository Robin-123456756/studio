import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// axe-core scans can be slow on heavy pages — increase timeout
test.use({ actionTimeout: 60_000 });

/**
 * Automated WCAG 2.1 accessibility audit using axe-core.
 * Scans key pages for violations at Level A and AA.
 *
 * axe-core checks ~90 rules including:
 * - Color contrast (WCAG AA 4.5:1 ratio)
 * - Missing alt text, labels, ARIA attributes
 * - Keyboard navigation issues
 * - Document structure (headings, landmarks)
 * - Form accessibility (labels, autocomplete)
 */

// Helper: run axe scan and return violations
async function scanPage(page: any) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations;
}

// Helper: format violations for readable output
function formatViolations(violations: any[]) {
  return violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    count: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n: any) => n.target.join(" > ")),
  }));
}

test.describe("WCAG 2.1 Accessibility Audit", () => {
  test("landing page passes axe audit", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    // Wait for splash to clear
    await page.waitForTimeout(10_000);
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Landing page a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    // Report violations but categorize by severity
    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    // Fail on critical/serious violations
    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on landing page`
    ).toHaveLength(0);
  });

  test("dashboard page passes axe audit", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5_000); // let async content load

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Dashboard a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on dashboard`
    ).toHaveLength(0);
  });

  test("dashboard page (mobile) passes axe audit", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Dashboard mobile a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on mobile dashboard`
    ).toHaveLength(0);
  });

  test("matches page passes axe audit", async ({ page }) => {
    await page.goto("/dashboard/matches", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Matches page a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on matches page`
    ).toHaveLength(0);
  });

  test("teams page passes axe audit", async ({ page }) => {
    await page.goto("/dashboard/teams", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Teams page a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on teams page`
    ).toHaveLength(0);
  });

  test("players page passes axe audit", async ({ page }) => {
    await page.goto("/dashboard/players", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Players page a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on players page`
    ).toHaveLength(0);
  });

  test("password reset page passes axe audit", async ({ page }) => {
    await page.goto("/auth/reset-password", { timeout: 60_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page);

    if (violations.length > 0) {
      console.log(
        "Reset password a11y violations:",
        JSON.stringify(formatViolations(violations), null, 2)
      );
    }

    const critical = violations.filter(
      (v: any) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      critical,
      `Found ${critical.length} critical/serious a11y violations on reset password page`
    ).toHaveLength(0);
  });
});

test.describe("Accessibility summary report", () => {
  test("generate full a11y report across all pages", async ({ page }) => {
    test.setTimeout(120_000);
    const pages = [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Teams", url: "/dashboard/teams" },
      { name: "Players", url: "/dashboard/players" },
      { name: "Matches", url: "/dashboard/matches" },
    ];

    const report: Record<
      string,
      { total: number; critical: number; serious: number; moderate: number; minor: number }
    > = {};

    for (const p of pages) {
      await page.goto(p.url, { timeout: 60_000 });
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      report[p.name] = {
        total: results.violations.length,
        critical: results.violations.filter((v) => v.impact === "critical").length,
        serious: results.violations.filter((v) => v.impact === "serious").length,
        moderate: results.violations.filter((v) => v.impact === "moderate").length,
        minor: results.violations.filter((v) => v.impact === "minor").length,
      };
    }

    console.log("\n=== WCAG 2.1 Accessibility Report ===");
    console.table(report);

    // This test always passes — it's a reporting test
    expect(true).toBe(true);
  });
});
