import { test, expect } from "@playwright/test";

const TEST_NAVIGATION = {
  button: {
    createNew: "create new",
    dashboard: "dashboard",
    courses: "Courses",
    profile: "profile",
    settings: "settings",
  },
  header: {
    welcomeBack: "Welcome back",
    coursesHeader: "Top 5 most popular courses",
    settings: "Settings",
  },
} as const;

test.describe("Content creator navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  test("should check content creator navigation", async ({ page }) => {
    await page
      .getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.courses, "i"), exact: true })
      .click();
    await page.waitForURL("/courses");
    const coursesHeader = page.getByRole("heading", { name: TEST_NAVIGATION.header.coursesHeader });
    await expect(coursesHeader).toHaveText(new RegExp(TEST_NAVIGATION.header.coursesHeader, "i"));

    await page.getByRole("button", { name: "Manage courses" }).click();
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.createNew, "i") })
      .waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);
    const currentURL = page.url();
    expect(currentURL).toMatch(/\/profile\/[a-f0-9-]{36}/);

    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();

    await page
      .getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");
    const settingsHeader = page.getByRole("heading", {
      name: TEST_NAVIGATION.header.settings,
    });
    await settingsHeader.waitFor({ state: "visible" });
    await expect(settingsHeader).toHaveText(new RegExp(TEST_NAVIGATION.header.settings, "i"));
  });
});
