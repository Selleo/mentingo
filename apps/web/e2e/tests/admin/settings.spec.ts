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
    const paragraph = page.locator("div.flex.flex-col.gap-y-2 p.body-base.mt-2.text-neutral-950");
    const jobTitle = page.locator("p.body-sm span.font-medium.text-neutral-950");
    await expect(paragraph).toHaveText(TEST_SETTINGS.description);
    await expect(jobTitle).toHaveText(TEST_SETTINGS.jobTitle);
  });
});
