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
  tabs: {
    account: "Account",
    organization: "Organization",
  },
} as const;

test.describe("Admin settings", () => {
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
    const jobTitle = page.locator("div.body-sm span.font-medium.text-neutral-950");

    await expect(paragraph).toHaveText(TEST_SETTINGS.description);
    await expect(jobTitle).toHaveText(TEST_SETTINGS.jobTitle);
  });

  test("should change admin new user notification setting", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

    const newUserNotificationSwitch = page.locator("#newUserNotifications");
    await newUserNotificationSwitch.click();
    await expect(newUserNotificationSwitch).toBeChecked();
  });

  test("should switch between Account and Organization tabs", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

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

  test("should toggle courses accessibility on Organization tab", async ({ page }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

    const tablist = page.getByRole("tablist");
    const organizationTab = tablist.getByRole("tab", { name: TEST_SETTINGS.tabs.organization });
    await organizationTab.click();
    await expect(organizationTab).toHaveAttribute("aria-selected", "true");

    const coursesSwitch = page.locator("#coursesAccessibility");

    await expect(coursesSwitch).toHaveAttribute("data-state", "checked");

    await coursesSwitch.click();
    await expect(coursesSwitch).toHaveAttribute("data-state", "unchecked");
  });

  test("should redirect to login when courses accessibility is disabled and user is logged out", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

    const tablist = page.getByRole("tablist");
    const organizationTab = tablist.getByRole("tab", { name: TEST_SETTINGS.tabs.organization });
    await organizationTab.click();

    const coursesSwitch = page.locator("#coursesAccessibility");

    const currentState = await coursesSwitch.getAttribute("data-state");
    if (currentState === "checked") {
      await coursesSwitch.click();
    }
    await expect(coursesSwitch).toHaveAttribute("data-state", "unchecked");

    await page
      .getByRole("button", { name: /logout/i })
      .filter({ hasText: "Logout" })
      .first()
      .click();

    await page.goto("/courses");

    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("should allow access to courses when courses accessibility is enabled and user is logged out", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: new RegExp(TEST_SETTINGS.button.settings, "i") })
      .click();
    await page.waitForURL("/settings");

    const tablist = page.getByRole("tablist");
    const organizationTab = tablist.getByRole("tab", { name: TEST_SETTINGS.tabs.organization });
    await organizationTab.click();

    const coursesSwitch = page.locator("#coursesAccessibility");

    const currentState = await coursesSwitch.getAttribute("data-state");
    if (currentState === "unchecked") {
      await coursesSwitch.click();
    }
    await expect(coursesSwitch).toHaveAttribute("data-state", "checked");

    await page
      .getByRole("button", { name: /logout/i })
      .filter({ hasText: "Logout" })
      .first()
      .click();

    await page.goto("/courses");

    await page.waitForURL(/\/courses/);
    await expect(page).toHaveURL(/\/courses/);
  });
});
