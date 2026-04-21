/**
 * visual-diff.spec.ts
 *
 * Screenshot baselines for all 18 existing DeXMart dashboard routes.
 * Baselines live in frontend/__visuals__/
 *
 * Capture:  pnpm visual-diff:update
 * Compare:  pnpm visual-diff
 *
 * Task 2.1.B.2 / 2.1.D.1 — Dashboard ControlUI Parity track, Phase 2.1
 *
 * NOTE: Requires dev server running (`pnpm dev`) and valid auth session.
 * In CI, set VISUAL_BASE_URL and inject auth cookies via storageState.
 */

import { expect, test } from "@playwright/test";

const ROUTES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/dashboard/home" },
  { name: "agents", path: "/dashboard/agents" },
  { name: "billing", path: "/dashboard/billing" },
  { name: "config", path: "/dashboard/config" },
  { name: "contacts", path: "/dashboard/contacts" },
  { name: "cron", path: "/dashboard/cron" },
  { name: "flows", path: "/dashboard/flows" },
  { name: "messages", path: "/dashboard/messages" },
  { name: "messages-campaigns", path: "/dashboard/messages/campaigns/demo" },
  { name: "nodes", path: "/dashboard/nodes" },
  { name: "omnichannel", path: "/dashboard/omnichannel" },
  { name: "omnichannel-reasoning", path: "/dashboard/omnichannel/reasoning" },
  { name: "settings", path: "/dashboard/settings" },
  { name: "skills", path: "/dashboard/skills" },
  { name: "templates", path: "/dashboard/templates" },
  { name: "usage", path: "/dashboard/usage" },
  { name: "webhooks", path: "/dashboard/webhooks" },
  { name: "root-settings", path: "/settings" },
];

for (const route of ROUTES) {
  test(`visual: ${route.name}`, async ({ page }) => {
    await page.goto(route.path);
    // Wait for layout paint — network idle catches async data loads
    await page.waitForLoadState("networkidle");
    // Dismiss any loading spinners (up to 3s)
    await page
      .waitForFunction(() => document.querySelectorAll('[data-loading="true"]').length === 0, {
        timeout: 3000,
      })
      .catch(() => {
        /* not all routes expose data-loading */
      });
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
}
