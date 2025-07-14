import { test, expect } from "@playwright/test";

const TEST_SETTINGS = {
  jobTitle: "Programming admin",
  description:
    "A passionate programming instructor with a deep understanding of coding languages and a knack for simplifying complex concepts.",
  button: {
    createNew: "create new",
    createCategory: "create category",
    save: "save",
    settings: "settings",
    profile: "profile",
  },
} as const;

test.describe("Content creator settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  test("should change admin information", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

    await page.locator('label[for="Bio - note"] + textarea').fill(TEST_SETTINGS.description);

    await page.locator('label[for="jobTitle"] + input').fill(TEST_SETTINGS.jobTitle);

    await page.locator('#user-details button[type="submit"]').click();

    await page.getByRole("button", { name: new RegExp(TEST_SETTINGS.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);
    const paragraph = page.getByText(TEST_SETTINGS.description);
    const jobTitle = page.getByText(TEST_SETTINGS.jobTitle);
    await expect(paragraph).toBeVisible();
    await expect(jobTitle).toBeVisible();
  });
});
