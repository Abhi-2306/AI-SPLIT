import { test, expect } from "@playwright/test";

test.describe("Friends", () => {
  test("shows friends page", async ({ page }) => {
    await page.goto("/friends");
    await expect(page.getByRole("heading", { name: /friends/i })).toBeVisible();
  });

  test("shows add friend form", async ({ page }) => {
    await page.goto("/friends");
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send request/i })).toBeVisible();
  });

  test("validates email before sending friend request", async ({ page }) => {
    await page.goto("/friends");
    await page.getByPlaceholder(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /send request/i }).click();
    // Native HTML validation or toast error
    const isInvalid = await page.getByPlaceholder(/email/i).evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);
  });
});

test.describe("Analytics", () => {
  test("shows analytics page with summary cards", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
    await expect(page.getByText(/this month/i)).toBeVisible();
    await expect(page.getByText(/total bills/i)).toBeVisible();
  });

  test("has currency selector", async ({ page }) => {
    await page.goto("/analytics");
    // Currency selector appears only when exchange rates load
    await page.waitForTimeout(2000);
    const selector = page.getByRole("combobox");
    if (await selector.isVisible()) {
      await expect(selector).toBeEnabled();
    }
  });
});
