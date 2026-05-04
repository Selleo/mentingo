import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("user can open settings from the profile menu and lands on account tab", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_CONTENT)).toBeVisible();
  });
});

test("user without settings management permission sees only account settings", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toHaveCount(0);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)).toHaveCount(0);
  });
});

test("admin with settings management permission sees all settings tabs", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openSettingsPageFlow(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toBeVisible();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB)).toBeVisible();
  });
});

test("organization tab shows warning indicator when configuration issues are not dismissed", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await page.route("**/api/env/config/setup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            fullyConfigured: [],
            partiallyConfigured: [{ service: "smtp", missingKeys: ["SMTP_HOST"] }],
            notConfigured: [],
            hasIssues: true,
            isWarningDismissed: false,
          },
        }),
      });
    });

    await openSettingsPageFlow(page);

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_WARNING_INDICATOR),
    ).toBeVisible();
  });
});
