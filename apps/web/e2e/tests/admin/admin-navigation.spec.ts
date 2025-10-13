import { test, expect } from "@playwright/test";

const TEST_NAVIGATION = {
  button: {
    createNew: "create new",
    dashboard: "dashboard",
    myCourses: "my courses",
    browseCourses: "browse courses",
    categories: "categories",
    users: "users",
    profile: "profile",
    settings: "settings",
    announcements: "announcements",
    manage: "manage",
  },
  header: {
    welcomeBack: "Welcome back",
    yourCourses: "Available Courses",
    changeUserInformation: "Change user information",
  },
} as const;

test.describe("Admin navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  test("should check admin navigation", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.dashboard, "i") })
      .click();
    await page.waitForURL("");
    const welcomeText = await page
      .locator("p")
      .filter({ hasText: TEST_NAVIGATION.header.welcomeBack });
    await expect(welcomeText).toHaveText(new RegExp(TEST_NAVIGATION.header.welcomeBack, "i"));

    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.myCourses, "i") })
      .click();
    await page.waitForURL("/admin/courses");
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.createNew, "i") })
      .waitFor({ state: "visible" });

    const announcementsButton = page.getByRole("link", {
      name: new RegExp(TEST_NAVIGATION.button.announcements, "i"),
    });

    if (!(await announcementsButton.isVisible())) {
      await page
        .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.manage, "i") })
        .first()
        .click();
    }

    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.browseCourses, "i") })
      .click();
    await page.waitForURL("/courses");
    const yourCoursesHeader = page.locator("h4", { hasText: TEST_NAVIGATION.header.yourCourses });
    await expect(yourCoursesHeader).toHaveText(new RegExp(TEST_NAVIGATION.header.yourCourses, "i"));

    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.categories, "i") })
      .click();
    await page.waitForURL("/admin/categories");
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.createNew, "i") })
      .waitFor({ state: "visible" });

    await page.getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.users, "i") }).click();
    await page.waitForURL("/admin/users");
    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.createNew, "i") })
      .waitFor({ state: "visible" });

    const userAvatar = page.getByRole("button", { name: /(avatar for|profile test)/i });

    await userAvatar.click();

    await page.getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);
    const currentURL = page.url();
    expect(currentURL).toMatch(/\/profile\/[a-f0-9-]{36}/);

    await userAvatar.click();

    await page
      .getByRole("link", { name: new RegExp(TEST_NAVIGATION.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");
    const settingsHeader = page.locator("h3", {
      hasText: TEST_NAVIGATION.header.changeUserInformation,
    });
    await settingsHeader.waitFor({ state: "visible" });
    await expect(settingsHeader).toHaveText(
      new RegExp(TEST_NAVIGATION.header.changeUserInformation, "i"),
    );
  });
});
