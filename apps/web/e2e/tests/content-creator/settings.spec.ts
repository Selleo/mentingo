import { test, expect } from "@playwright/test";

const TEST_SETTINGS = {
  jobTitle: "Programming content creator",
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
  test("should change content creator informations", async ({ page }) => {
    await page.getByRole("button", { name: /(avatar for|profile test)/i }).click();
    await page.getByRole("link", { name: new RegExp(TEST_SETTINGS.button.settings, "i") }).click();
    await page.waitForURL("/settings");

    await page.locator('label[for="Bio - note"] + textarea').fill(TEST_SETTINGS.description);
    await page.locator('label[for="jobTitle"] + input').fill(TEST_SETTINGS.jobTitle);
    await page.locator('#user-details button[type="submit"]').click();

    await page.getByRole("button", { name: /(avatar for|profile test)/i }).click();
    await page.getByRole("link", { name: new RegExp(TEST_SETTINGS.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);

    const description = page.getByTestId("description");
    const jobTitle = page.getByTestId("jobTitle");

    await expect(description).toHaveText(TEST_SETTINGS.description);
    await expect(jobTitle).toHaveText(TEST_SETTINGS.jobTitle);
  });
});
