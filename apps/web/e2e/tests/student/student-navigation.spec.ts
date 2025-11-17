import { test, expect } from "@playwright/test";

const TEST_NAVIGATION = {
  button: {
    createNew: "create new",
    dashboard: "dashboard",
    browseCourses: "Courses",
    profile: "profile",
    settings: "settings",
  },
  header: {
    welcomeBack: "Welcome back",
    yourCourses: "Your courses",
    settings: "Settings",
  },
} as const;

test.describe("Student navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should check student navigation", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.dashboard, "i") })
      .click();
    await page.waitForURL("");
    const welcomeText = await page
      .locator("p")
      .filter({ hasText: TEST_NAVIGATION.header.welcomeBack });
    await expect(welcomeText).toHaveText(new RegExp(TEST_NAVIGATION.header.welcomeBack, "i"));

    await page
      .getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.browseCourses, "i") })
      .click();
    await page.waitForURL("/courses");
    const yourCoursesHeader = page.locator("h4", { hasText: TEST_NAVIGATION.header.yourCourses });
    await expect(yourCoursesHeader).toHaveText(new RegExp(TEST_NAVIGATION.header.yourCourses, "i"));

    const userName = "test Student profile test";
    await page.getByRole("button", { name: userName }).click();
    await page.getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);
    const currentURL = page.url();
    expect(currentURL).toMatch(/\/profile\/[a-f0-9-]{36}/);

    await page.getByRole("button", { name: userName }).click();
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
