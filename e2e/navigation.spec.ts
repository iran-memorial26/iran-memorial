import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads with correct title", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Iran Memorial/);
  });

  test("can navigate to victims page", async ({ page }) => {
    await page.goto("/en");
    await page.click('a[href*="/victims"]');
    await expect(page).toHaveURL(/\/en\/victims/);
  });

  test("can navigate to timeline", async ({ page }) => {
    await page.goto("/en");
    await page.click('a[href*="/timeline"]');
    await expect(page).toHaveURL(/\/en\/timeline/);
  });

  test("can navigate to map", async ({ page }) => {
    await page.goto("/en");
    await page.click('a[href*="/map"]');
    await expect(page).toHaveURL(/\/en\/map/);
  });

  test("language switcher works", async ({ page }) => {
    await page.goto("/en");
    // Switch to Farsi
    const farsiLink = page.locator('a[href*="/fa"]').first();
    if (await farsiLink.isVisible()) {
      await farsiLink.click();
      await expect(page).toHaveURL(/\/fa/);
      // Verify RTL direction
      const html = page.locator("html");
      await expect(html).toHaveAttribute("dir", "rtl");
    }
  });
});

test.describe("Search", () => {
  test("search form exists on homepage", async ({ page }) => {
    await page.goto("/en");
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]');
    await expect(searchInput.first()).toBeVisible();
  });

  test("victims page has filter controls", async ({ page }) => {
    await page.goto("/en/victims");
    // Check for filter dropdowns or buttons
    await expect(page.locator("select, button").first()).toBeVisible();
  });
});

test.describe("Submit Form", () => {
  test("submission form loads", async ({ page }) => {
    await page.goto("/en/submit");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="name_latin"]')).toBeVisible();
  });
});

test.describe("API", () => {
  test("search API returns JSON", async ({ request }) => {
    const response = await request.get("/api/search?q=test");
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBeTruthy();
  });

  test("export API returns data", async ({ request }) => {
    const response = await request.get("/api/export?format=json");
    expect([200, 429]).toContain(response.status());
  });

  test("sitemap.xml is accessible", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
  });

  test("robots.txt is accessible", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain("Sitemap:");
  });
});
