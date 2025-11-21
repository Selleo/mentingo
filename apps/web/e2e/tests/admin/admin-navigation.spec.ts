import { test, expect } from "@playwright/test";

const TEST_NAVIGATION = {
  button: {
    createNew: "create new",
    dashboard: "dashboard",
    myCourses: "Courses",
    browseCourses: "browse courses",
    categories: "categories",
    users: "users",
    profile: "profile",
    settings: "settings",
    announcements: "announcements",
    manage: "Manage",
  },
  header: {
    welcomeBack: "Welcome back",
    yourCourses: "Available Courses",
    settings: "Settings",
    manageCourses: "Manage courses",
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
    const welcomeText = page.locator("p").filter({ hasText: TEST_NAVIGATION.header.welcomeBack });
    await expect(welcomeText).toHaveText(new RegExp(TEST_NAVIGATION.header.welcomeBack, "i"));

    await page
      .getByRole("button", { name: new RegExp(TEST_NAVIGATION.button.myCourses, "i") })
      .click();
    await page.waitForURL("/courses");
    await page.locator(".h-min > button:nth-child(2)").click();
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

    const manageCoursesHeader = page.getByRole("heading", { name: "Manage Courses" });
    await expect(manageCoursesHeader).toBeVisible();

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

    const userAvatar = page.getByRole("button", { name: "Avatar for email@example.com" });

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
    const settingsHeader = page.getByRole("heading", {
      name: TEST_NAVIGATION.header.settings,
      exact: true,
    });
    await settingsHeader.waitFor({ state: "visible" });
    await expect(settingsHeader).toHaveText(new RegExp(TEST_NAVIGATION.header.settings, "i"));
  });
});
