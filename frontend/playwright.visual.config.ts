import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression config.
 * Baselines stored under frontend/__visuals__/
 * Run: pnpm visual-diff          (compare against baselines)
 * Run: pnpm visual-diff:update   (capture / update baselines)
 */
export default defineConfig({
  testDir: "./src/e2e",
  testMatch: "visual-diff.spec.ts",
  snapshotDir: "./__visuals__",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}",

  fullyParallel: true,
  retries: 0,
  workers: 2,

  reporter: [["list"], ["html", { outputFolder: "__visuals__/report", open: "never" }]],

  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "off",
    trace: "off",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
      },
    },
  ],
});
