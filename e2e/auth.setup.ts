import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, ".auth/user.json");

/**
 * Logs in using test credentials and saves the auth cookies so all other
 * tests can reuse the session without re-logging in.
 *
 * Credentials: E2E_EMAIL / E2E_PASSWORD env vars (defaults: test@aisplit.dev / testpass123)
 * Create the test user first: node scripts/create-test-user.mjs
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL ?? "test@aisplit.dev";
  const password = process.env.E2E_PASSWORD ?? "testpass123";

  await page.goto("/login");

  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for successful redirect to dashboard
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.getByText("AI Split")).toBeVisible();

  // Save auth state (cookies + localStorage) for reuse across tests
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
