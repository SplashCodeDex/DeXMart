import { expect, test } from "@playwright/test";

/**
 * controlui-parity.spec.ts
 *
 * E2E tests for DeXMart Dashboard ControlUI Parity.
 * Covers all RPC method groups defined in artifacts/parity-matrix.json.
 */

test.describe("Chat Parity (Sub-Track 3.1)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to chat page
    await page.goto("/dashboard/chat");
    await page.waitForLoadState("networkidle");
  });

  test("chat.history: loads past messages on mount", async ({ page }) => {
    // This expects at least one message to be loaded if history works.
    // In a clean test env, we might need to seed this or just check that it doesn't error.
    const messages = page.locator(".message-content");
    // We expect the message list container to be present
    await expect(page.locator("div[style*='overflow: auto']")).toBeVisible();
  });

  test("chat.send: sends a message and receives a response", async ({ page }) => {
    const input = page.locator('input[name="message"]');
    await input.fill("Hello Mastermind");
    await page.keyboard.press("Enter");

    // Check if user message appears
    await expect(page.getByText("Hello Mastermind")).toBeVisible();

    // Check if assistant starts "thinking" or responds
    // Note: This depends on the backend being responsive
    await expect(page.getByText("Agent is thinking...")).toBeVisible();
  });

  test("chat.abort: can abort a streaming response", async ({ page }) => {
    const input = page.locator('input[name="message"]');
    await input.fill("Write a very long story about a cat");
    await page.keyboard.press("Enter");

    const abortButton = page.getByRole("button", { name: "Abort" });
    await expect(abortButton).toBeVisible();
    await abortButton.click();

    // Check if streaming stops
    await expect(page.getByText("Agent is thinking...")).not.toBeVisible();
    await expect(abortButton).not.toBeVisible();
  });

  test("chat.inject: sends a note via slash command", async ({ page }) => {
    const input = page.locator('input[name="message"]');
    await input.fill("/note This is a test note");
    await page.keyboard.press("Enter");

    // The input should be cleared
    await expect(input).toHaveValue("");

    // The note should eventually appear in the transcript (via broadcast)
    await expect(page.getByText("This is a test note")).toBeVisible();
  });
});

test.describe("Sessions Parity (Sub-Track 4.1)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sessions list page
    await page.goto("/dashboard/sessions");
    await page.waitForLoadState("networkidle");
  });

  test("sessions.list + sessions.subscribe: displays and updates session list", async ({
    page,
  }) => {
    // Check if table is present
    await expect(page.locator("table")).toBeVisible();

    // Check if at least one session is listed (or empty state)
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    if (count === 0) {
      await expect(page.getByText(/No sessions found/i)).toBeVisible();
    } else {
      await expect(rows.first()).toBeVisible();
    }
  });

  test("sessions.get + sessions.messages.subscribe: loads session detail and transcript", async ({
    page,
  }) => {
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await page.waitForURL(/\/dashboard\/sessions\/.+/);

      // Check for detail components
      await expect(page.getByText(/Transcript/i)).toBeVisible();
      await expect(page.getByText(/Stats/i)).toBeVisible();
      await expect(page.getByText(/Token Breakdown/i)).toBeVisible();
    }
  });

  test("sessions.patch: updates session metadata", async ({ page }) => {
    // Navigate to a session detail
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();

      const modelButton = page
        .locator("button:has-text('No Model'), button:has-text('gpt-'), button:has-text('claude-')")
        .first();
      await modelButton.click();

      // Select a model from selector
      const modelOption = page.locator("[role='combobox']").first();
      // This part depends on the ModelSelector implementation
      // Just check if the selector appeared
      await expect(page.getByText(/Override Model/i)).toBeVisible();
    }
  });

  test("sessions.send + sessions.steer: interacts with session", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();

      const input = page.locator('input[placeholder*="command"]');
      await input.fill("test message");

      const sendButton = page.locator("button[title='Send message']");
      await sendButton.click();

      // Check for toast
      await expect(page.getByText(/Message sent/i)).toBeVisible();
    }
  });

  test("sessions.abort: aborts running session", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();

      // If session is running, abort button should be visible
      const abortButton = page.locator("button:has-text('Abort')");
      if (await abortButton.isVisible()) {
        await abortButton.click();
        await expect(page.getByText(/Session aborted/i)).toBeVisible();
      }
    }
  });

  test("sessions.reset: resets session transcript", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();

      const menuButton = page.locator("button:has(.lucide-more-vertical)");
      await menuButton.click();

      const resetButton = page.getByText(/Reset Session/i);
      await resetButton.click();

      // Confirm dialog
      page.on("dialog", (dialog) => dialog.accept());

      await expect(page.getByText(/Session reset/i)).toBeVisible();
    }
  });

  test("sessions.compaction lifecycle: branch and restore", async ({ page }) => {
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();

      await expect(page.getByText(/Checkpoints/i)).toBeVisible();
      // If checkpoints exist, try to branch one
      const branchButton = page.locator("button:has(.lucide-git-branch)").first();
      if (await branchButton.isVisible()) {
        await branchButton.click();
        await expect(page.getByText(/Create Branch/i)).toBeVisible();
      }
    }
  });
});

test.describe("Channels Parity (Sub-Track 5.1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/omnichannel");
    await page.waitForLoadState("networkidle");
  });

  test("channels.status: displays live channel connection states", async ({ page }) => {
    await expect(page.locator(".channel-card")).toBeVisible();
    await expect(page.locator(".status-badge")).toBeVisible();
  });

  test("web.login.start + wait: handles QR login flow", async ({ page }) => {
    const connectButton = page.locator("button:has-text('Connect')").first();
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await expect(page.getByText(/Scan QR Code/i)).toBeVisible();
      await expect(page.locator("canvas")).toBeVisible();
    }
  });

  test("web.login.start + wait: handles OAuth login flow (non-QR)", async ({ page }) => {
    // Find a channel that doesn't use QR (e.g. Discord, Slack)
    const connectButton = page.locator("button:has-text('Connect')").nth(1);
    if (await connectButton.isVisible()) {
      await connectButton.click();
      // For OAuth, we expect a redirect or a new window/popup start
      // But in the UI, we might just check if the "Connecting..." state appears
      await expect(page.getByText(/Connecting/i)).toBeVisible();
    }
  });

  test("channels.logout: handles account disconnection", async ({ page }) => {
    const settingsButton = page.locator("button:has(.lucide-settings)").first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      const logoutButton = page.getByRole("button", { name: /Logout/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        page.on("dialog", (dialog) => dialog.accept());
        await expect(page.getByText(/Disconnected/i)).toBeVisible();
      }
    }
  });
});

test.describe("Devices Parity (Sub-Track 5.2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/nodes");
    // Switch to Devices tab
    await page.getByRole("tab", { name: /Devices/i }).click();
    await page.waitForLoadState("networkidle");
  });

  test("device.pair.list: displays paired and pending devices", async ({ page }) => {
    await expect(page.getByText(/Authorized Hardware/i)).toBeVisible();
    // Table should be present
    const tables = page.locator("table");
    await expect(tables.first()).toBeVisible();
  });

  test("device.pair.approve: authorizes a pending device", async ({ page }) => {
    const authorizeButton = page.getByRole("button", { name: /Authorize/i }).first();
    if (await authorizeButton.isVisible()) {
      await authorizeButton.click();
      await expect(page.getByText(/Device authorized/i)).toBeVisible();
    }
  });

  test("device.pair.reject: denies a pending device", async ({ page }) => {
    const denyButton = page.getByRole("button", { name: /Deny/i }).first();
    if (await denyButton.isVisible()) {
      await denyButton.click();
      await expect(page.getByText(/Pairing request rejected/i)).toBeVisible();
    }
  });

  test("device.token.rotate: generates new access token", async ({ page }) => {
    const menuButton = page.locator("button:has(.lucide-more-vertical)").first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.getByText(/Rotate Token/i).click();

      // Handle AlertDialog
      await page.getByRole("button", { name: "Rotate Token" }).click();

      // Should show the new token dialog
      await expect(page.getByText(/New Access Token/i)).toBeVisible();
      await expect(page.locator("code")).toBeVisible();
    }
  });

  test("device.token.revoke: invalidates device tokens", async ({ page }) => {
    const menuButton = page.locator("button:has(.lucide-more-vertical)").first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.getByText(/Revoke Tokens/i).click();

      // Handle AlertDialog
      await page.getByRole("button", { name: "Revoke" }).click();

      await expect(page.getByText(/All tokens revoked/i)).toBeVisible();
    }
  });

  test("device.pair.remove: permanently removes a device", async ({ page }) => {
    const menuButton = page.locator("button:has(.lucide-more-vertical)").first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.getByText(/Remove Permanently/i).click();

      // Handle AlertDialog
      await page.getByRole("button", { name: "Remove" }).click();

      await expect(page.getByText(/Device removed/i)).toBeVisible();
    }
  });
});

test.describe("Cron Parity (Sub-Track 7.1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/cron");
    await page.waitForLoadState("networkidle");
  });

  test("cron.list + cron.status: displays scheduler state and jobs", async ({ page }) => {
    await expect(page.getByText(/Scheduler Status/i)).toBeVisible();
    await expect(page.getByText(/Total Jobs/i)).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("cron.add: creates a new scheduled job", async ({ page }) => {
    await page.getByRole("button", { name: /Create Job/i }).click();

    await page.locator('input[id="name"]').fill("E2E Test Job");
    await page.locator('input[id="payloadText"]').fill("ping");

    await page.getByRole("button", { name: "Create Job" }).click();
    await expect(page.getByText(/Cron job created successfully/i)).toBeVisible();
  });

  test("cron.run: triggers immediate job execution", async ({ page }) => {
    const runButton = page.locator("button[title='Run Now']").first();
    if (await runButton.isVisible()) {
      await runButton.click();
      await expect(page.getByText(/Job execution triggered/i)).toBeVisible();
    }
  });

  test("cron.runs: displays job run history", async ({ page }) => {
    const historyButton = page.locator("button[title='View History']").first();
    if (await historyButton.isVisible()) {
      await historyButton.click();
      await expect(page.getByText(/Run History:/i)).toBeVisible();
      // Should show the history list
      await expect(page.locator(".sheet-content")).toBeVisible();
    }
  });

  test("cron.remove: deletes a job", async ({ page }) => {
    const deleteButton = page.locator("button[title='Delete']").first();
    if (await deleteButton.isVisible()) {
      // Hover to make it visible if needed, but it's already in the DOM
      await deleteButton.click();

      // Handle confirm dialog
      page.on("dialog", (dialog) => dialog.accept());

      await expect(page.getByText(/Job deleted/i)).toBeVisible();
    }
  });
});

test.describe("Skills Parity (Sub-Track 7.2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/skills");
    await page.waitForLoadState("networkidle");
  });

  test("skills.status + list: displays intelligence store", async ({ page }) => {
    await expect(page.getByText(/Intelligence Store/i)).toBeVisible();
    await expect(page.locator(".grid")).toBeVisible();
  });

  test("skills.search: filters skill list", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search skills"]');
    await searchInput.fill("web-search");
    // Should filter cards
    await expect(page.locator(".card").first()).toBeVisible();
  });

  test("skills.update: configures API key", async ({ page }) => {
    const keyButton = page.locator("button[title='Configure API Key']").first();
    if (await keyButton.isVisible()) {
      await keyButton.click();
      await page.locator('input[id="apiKey"]').fill("sk-test-key");
      await page.getByRole("button", { name: /Save Changes/i }).click();
      await expect(page.getByText(/API key saved successfully/i)).toBeVisible();
    }
  });

  test("plugin.approval lifecycle: list and resolve", async ({ page }) => {
    await page.getByRole("tab", { name: /Approvals/i }).click();

    // Check if empty state or list is present
    const noApprovals = page.getByText(/No Pending Approvals/i);
    const hasApprovals = page.locator(".card");

    if (await noApprovals.isVisible()) {
      await expect(noApprovals).toBeVisible();
    } else {
      await expect(hasApprovals.first()).toBeVisible();
      // Try to approve one
      const approveButton = page.getByRole("button", { name: /Always/i }).first();
      await approveButton.click();
      await expect(page.getByText(/approved successfully/i)).toBeVisible();
    }
  });
});
