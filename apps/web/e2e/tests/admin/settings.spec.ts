import { test, expect } from "@playwright/test";

const TEST_SETTINGS = {
  pageTitle: "Settings",
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
  tabs: {
    account: "Account",
    organization: "Organization",
    platformCustomization: "Platform Customization",
  },
} as const;

test.describe("Admin settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /(avatar for|profile test)/i }).click();

    await page.getByRole("link", { name: new RegExp(TEST_SETTINGS.button.settings, "i") }).click();

    const header = page.getByRole("heading", { name: "Settings", exact: true });

    await header.waitFor({ state: "visible" });
  });

  test("should change admin information", async ({ page }) => {
    await page.locator('label[for="Bio - note"] + textarea').fill(TEST_SETTINGS.description);
    await page.locator('label[for="jobTitle"] + input').fill(TEST_SETTINGS.jobTitle);
    await page.locator('#user-details button[type="submit"]').click();

    await page.getByRole("button", { name: "Test Admin profile Test Admin" }).click();
    await page.getByRole("link", { name: new RegExp(TEST_SETTINGS.button.profile, "i") }).click();
    await page.waitForURL(/\/profile\/[a-f0-9-]{36}/);

    const description = page.getByTestId("description");
    const jobTitle = page.getByTestId("jobTitle");

    await expect(description).toHaveText(TEST_SETTINGS.description);
    await expect(jobTitle).toHaveText(TEST_SETTINGS.jobTitle);
  });

  test("should change admin new user notification setting", async ({ page }) => {
    const newUserNotificationSwitch = page.locator("#newUserNotifications");
    await newUserNotificationSwitch.click();
    await expect(newUserNotificationSwitch).toBeChecked();
  });

  test("should switch between Account and Organization tabs", async ({ page }) => {
    const tablist = page.getByRole("tablist");
    const accountTab = tablist.getByRole("tab", { name: TEST_SETTINGS.tabs.account });
    const organizationTab = tablist.getByRole("tab", { name: TEST_SETTINGS.tabs.organization });

    await expect(accountTab).toHaveAttribute("aria-selected", "true");
    await expect(accountTab).toHaveAttribute("data-state", "active");
    await expect(organizationTab).toHaveAttribute("aria-selected", "false");
    await expect(organizationTab).toHaveAttribute("data-state", "inactive");

    await organizationTab.click();

    await expect(organizationTab).toHaveAttribute("aria-selected", "true");
    await expect(organizationTab).toHaveAttribute("data-state", "active");
    await expect(accountTab).toHaveAttribute("aria-selected", "false");
    await expect(accountTab).toHaveAttribute("data-state", "inactive");
  });

  test("should toggle courses accessibility on platform customization tab", async ({ page }) => {
    const tablist = page.getByRole("tablist");
    const platformTab = tablist.getByRole("tab", {
      name: TEST_SETTINGS.tabs.platformCustomization,
    });
    await platformTab.click();
    await expect(platformTab).toHaveAttribute("aria-selected", "true");

    const coursesSwitch = page.locator("#coursesVisibility");

    const currentState = await coursesSwitch.getAttribute("data-state");
    const expectedState = currentState === "checked" ? "unchecked" : "checked";

    await coursesSwitch.click();
    await expect(coursesSwitch).toHaveAttribute("data-state", expectedState);
  });

  test("should redirect to login when courses accessibility is disabled and user is logged out", async ({
    browser,
    page,
  }) => {
    const tablist = page.getByRole("tablist");
    const platformTab = tablist.getByRole("tab", {
      name: TEST_SETTINGS.tabs.platformCustomization,
    });
    await platformTab.click();

    const coursesSwitch = page.locator("#coursesVisibility");

    const currentState = await coursesSwitch.getAttribute("data-state");
    if (currentState === "checked") {
      await coursesSwitch.click();
    }
    await expect(coursesSwitch).toHaveAttribute("data-state", "unchecked");

    await page.getByRole("button", { name: "Test Admin profile Test Admin" }).click();

    await page
      .getByRole("menuitem", { name: /logout/i })
      .locator("div")
      .click();

    const newPage = await browser.newPage();
    newPage.context().clearCookies();

    await newPage.goto("/courses");

    await newPage.waitForURL(/\/login/);
    await expect(newPage).toHaveURL(/\/login/);
  });

  test("should allow access to courses when courses accessibility is enabled and user is logged out", async ({
    page,
  }) => {
    const tablist = page.getByRole("tablist");
    const platformTab = tablist.getByRole("tab", {
      name: TEST_SETTINGS.tabs.platformCustomization,
    });
    await platformTab.click();

    const coursesSwitch = page.locator("#coursesVisibility");

    const currentState = await coursesSwitch.getAttribute("data-state");
    if (currentState === "unchecked") {
      await coursesSwitch.click();
    }
    await expect(coursesSwitch).toHaveAttribute("data-state", "checked");

    await page.getByRole("button", { name: "Test Admin profile Test Admin" }).click();

    await page
      .getByRole("menuitem", { name: /logout/i })
      .locator("div")
      .click();

    await page.goto("/courses");

    await page.waitForURL(/\/courses/);
    await expect(page).toHaveURL(/\/courses/);
  });

  test("should not display sign-up option when invite-only registration is enabled", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Organization" }).click();
    await page.locator("#invite-only-registration").getByRole("switch").click();
    await page.locator("#invite-only-registration").getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
    const loginHeader = page.getByRole("heading", { name: "Login", exact: true });
    await loginHeader.waitFor({ state: "visible" });
    await expect(page.getByText("Don't have an account? Sign up")).not.toBeVisible();
  });

  test("should check courses visibility based on platform preferences", async ({ page }) => {
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
    await page.goto("https://app.lms.localhost/courses");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await page.getByPlaceholder("user@example.com").click();
    await page.getByPlaceholder("user@example.com").fill("admin@example.com");
    await page.getByLabel("Password").click();
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Login" }).click();
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Platform Customization" }).click();
    await page.getByLabel("Show courses to visitors").click();
    await expect(
      page.getByLabel("Notifications (F8)").getByText("Course visibility preferences"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).locator("div").click();
    await page.goto("https://app.lms.localhost/courses");
    await expect(page.getByRole("heading", { name: "Available Courses" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("should change platform colors", async ({ page }) => {
    const HEX_PRIMARY = "#800080";
    const HEX_CONTRAST = "#faf0e6";
    const RGB_PRIMARY = "rgb(128, 0, 128)";
    const RGB_CONTRAST = "rgb(250, 240, 230)";

    await page.getByRole("button", { name: "Avatar for email@example.com" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "Platform Customization" }).click();
    await page.locator("#primary-color-input").dblclick();
    await page.locator("#primary-color-input").fill(HEX_PRIMARY.replace("#", ""));
    await page.locator("#contrast-color-input").dblclick();
    await page.locator("#contrast-color-input").fill(HEX_CONTRAST.replace("#", ""));
    await page.getByRole("button", { name: "Save" }).nth(4).click();
    await page.getByRole("button", { name: "Dashboard" }).getByRole("link").click();
    const downloadReport = page.getByRole("button", { name: "Download Report" });
    await expect(downloadReport).toBeVisible();
    await expect(downloadReport).toHaveCSS("background-color", RGB_PRIMARY);
    await expect(downloadReport).toHaveCSS("color", RGB_CONTRAST);
  });
});
