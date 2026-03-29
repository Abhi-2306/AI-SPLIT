import { test, expect } from "@playwright/test";

test.describe("Bill creation flow", () => {
  /**
   * Full happy-path: create bill → add item → add participant → assign → summary
   */
  test("creates a bill and completes the full flow", async ({ page }) => {
    // ── Step 0: Create the bill ─────────────────────────────────────────────
    await page.goto("/bills/new");
    await page.getByPlaceholder(/e\.g\. Dinner/i).fill("E2E Test Dinner");
    await page.getByRole("button", { name: /create bill/i }).click();

    // Land on bill editor (step 1 — Items)
    await page.waitForURL(/\/bills\/.+/);
    await expect(page.getByText(/step 1/i)).toBeVisible();

    // ── Step 1: Add an item manually ────────────────────────────────────────
    await page.getByPlaceholder("e.g. Pizza Margherita").fill("Margherita Pizza");
    await page.getByLabel("Qty").fill("2");
    await page.getByLabel("Unit Price").fill("12.50");
    await page.getByRole("button", { name: /^\+ add$/i }).click();

    // Item appears in the table
    await expect(page.getByRole("cell", { name: "Margherita Pizza" })).toBeVisible();

    // Proceed to step 2
    await page.getByRole("button", { name: /next.*people/i }).click();
    await expect(page.getByText(/step 2/i)).toBeVisible();

    // ── Step 2: Add a participant ────────────────────────────────────────────
    await page.getByPlaceholder("Enter participant name").fill("Alice");
    await page.getByRole("button", { name: /^add$/i }).click();

    // Alice chip appears
    await expect(page.getByText("Alice")).toBeVisible();

    // Proceed to step 3
    await page.getByRole("button", { name: /next.*assign/i }).click();
    await expect(page.getByText(/assign items/i)).toBeVisible();

    // ── Step 3: Assignment matrix visible ───────────────────────────────────
    await expect(page.getByText("Margherita Pizza")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();

    // Navigate to summary (step 4 label)
    await page.getByRole("button", { name: /next.*summary/i }).click();
    await page.waitForURL(/\/bills\/.+\/summary/);
    await expect(page.getByText(/summary/i)).toBeVisible();
  });

  test("bill title is required", async ({ page }) => {
    await page.goto("/bills/new");
    await page.getByRole("button", { name: /create bill/i }).click();
    // Should stay on /bills/new (no navigation)
    await expect(page).toHaveURL("/bills/new");
  });

  test("item name is required", async ({ page }) => {
    await page.goto("/bills/new");
    await page.getByPlaceholder(/e\.g\. Dinner/i).fill("Test Bill");
    await page.getByRole("button", { name: /create bill/i }).click();
    await page.waitForURL(/\/bills\/.+/);

    // Try to add item without a name
    await page.getByRole("button", { name: /^\+ add$/i }).click();
    // Toast error should appear
    await expect(page.getByText(/item name is required/i)).toBeVisible();
  });
});
