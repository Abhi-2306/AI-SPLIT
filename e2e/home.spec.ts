import { test, expect } from "@playwright/test";

test.describe("Home / Dashboard", () => {
  test("shows dashboard with New Bill button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /my bills/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /new bill/i })).toBeVisible();
  });

  test("navigates to /bills/new", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /new bill/i }).first().click();
    await page.waitForURL("/bills/new");
    await expect(page.getByPlaceholder(/e\.g\. Dinner/i)).toBeVisible();
  });

  test("navigates to Friends page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /friends/i }).click();
    await page.waitForURL("/friends");
    await expect(page.getByRole("heading", { name: /friends/i })).toBeVisible();
  });

  test("navigates to Analytics page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /analytics/i }).click();
    await page.waitForURL("/analytics");
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
  });

  test("search filters bill list", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.getByPlaceholder(/search bills/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("zzz_no_match_xyz");
      await expect(page.getByText(/no bills/i)).toBeVisible();
    }
  });
});
