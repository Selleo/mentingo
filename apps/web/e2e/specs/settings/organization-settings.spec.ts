import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

import type { FixtureApiClient } from "../../utils/api-client";
import type { Locator, Page } from "@playwright/test";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

type GlobalSettings = GetPublicGlobalSettingsResponse["data"];
type UserEmailTriggerKey = keyof GlobalSettings["userEmailTriggers"];

const openOrganizationSettings = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
  await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT)).toBeVisible();
};

const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

const expectSwitchState = async (locator: Locator, checked: boolean) => {
  if (checked) {
    await expect(locator).toBeChecked();
  } else {
    await expect(locator).not.toBeChecked();
  }
};

test("admin can toggle SSO enforcement when OAuth is enabled and the setting persists", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      const currentSettings = await getGlobalSettings(apiClient);
      if (currentSettings.enforceSSO !== originalSettings.enforceSSO) {
        await apiClient.api.settingsControllerUpdateEnforceSso();
      }
    });

    await openOrganizationSettings(page);

    const card = page.getByTestId(SETTINGS_PAGE_HANDLES.SSO_ENFORCEMENT_CARD);
    const isSSOCardVisible = await card.isVisible({ timeout: 3_000 }).catch(() => false);
    test.skip(!isSSOCardVisible, "OAuth is not enabled for this E2E environment.");

    await page.getByTestId(SETTINGS_PAGE_HANDLES.SSO_ENFORCEMENT_SWITCH).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.SSO_ENFORCEMENT_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).enforceSSO)
      .toBe(!originalSettings.enforceSSO);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await expectSwitchState(
      page.getByTestId(SETTINGS_PAGE_HANDLES.SSO_ENFORCEMENT_SWITCH),
      !originalSettings.enforceSSO,
    );
  });
});

test("admin can toggle invite-only registration and the setting persists", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);

    cleanup.add(async () => {
      const currentSettings = await getGlobalSettings(apiClient);
      if (currentSettings.inviteOnlyRegistration !== originalSettings.inviteOnlyRegistration) {
        await apiClient.api.settingsControllerUpdateInviteOnlyRegistration();
      }
    });

    await openOrganizationSettings(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SWITCH).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).inviteOnlyRegistration)
      .toBe(!originalSettings.inviteOnlyRegistration);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();
    await expectSwitchState(
      page.getByTestId(SETTINGS_PAGE_HANDLES.INVITE_ONLY_REGISTRATION_SWITCH),
      !originalSettings.inviteOnlyRegistration,
    );
  });
});

test("admin can toggle each user email trigger and the changed state persists", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const triggerKeys = Object.keys(originalSettings.userEmailTriggers) as UserEmailTriggerKey[];

    cleanup.add(async () => {
      const currentSettings = await getGlobalSettings(apiClient);

      for (const triggerKey of triggerKeys) {
        if (
          currentSettings.userEmailTriggers[triggerKey] !==
          originalSettings.userEmailTriggers[triggerKey]
        ) {
          await apiClient.api.settingsControllerUpdateUserEmailTriggers(triggerKey);
        }
      }
    });

    await openOrganizationSettings(page);

    for (const triggerKey of triggerKeys) {
      await page.getByTestId(SETTINGS_PAGE_HANDLES.userEmailTriggerSwitch(triggerKey)).click();
      await expect
        .poll(async () => (await getGlobalSettings(apiClient)).userEmailTriggers[triggerKey])
        .toBe(!originalSettings.userEmailTriggers[triggerKey]);
    }

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB).click();

    for (const triggerKey of triggerKeys) {
      await expectSwitchState(
        page.getByTestId(SETTINGS_PAGE_HANDLES.userEmailTriggerSwitch(triggerKey)),
        !originalSettings.userEmailTriggers[triggerKey],
      );
    }
  });
});

test("admin can enable or disable MFA enforcement per role and save only when changes exist", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const originalRoles = new Set(originalSettings.MFAEnforcedRoles);
    const targetRoles = {
      admin: !originalRoles.has(USER_ROLE.admin),
      student: !originalRoles.has(USER_ROLE.student),
      content_creator: !originalRoles.has(USER_ROLE.contentCreator),
    };

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
        admin: originalRoles.has(USER_ROLE.admin),
        student: originalRoles.has(USER_ROLE.student),
        content_creator: originalRoles.has(USER_ROLE.contentCreator),
      });
    });

    await openOrganizationSettings(page);

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE)).toBeDisabled();

    await page.getByTestId(SETTINGS_PAGE_HANDLES.mfaRoleSwitch(USER_ROLE.admin)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.mfaRoleSwitch(USER_ROLE.student)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.mfaRoleSwitch(USER_ROLE.contentCreator)).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE)).toBeEnabled();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE).click();

    await expect
      .poll(async () => {
        const currentRoles = new Set((await getGlobalSettings(apiClient)).MFAEnforcedRoles);

        return {
          admin: currentRoles.has(USER_ROLE.admin),
          student: currentRoles.has(USER_ROLE.student),
          content_creator: currentRoles.has(USER_ROLE.contentCreator),
        };
      })
      .toEqual(targetRoles);
  });
});

test("admin can change the default course currency when Stripe is configured", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const targetCurrency = originalSettings.defaultCourseCurrency === "pln" ? "eur" : "pln";

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateDefaultCourseCurrency({
        defaultCourseCurrency: originalSettings.defaultCourseCurrency,
      });
    });

    await page.route("**/api/env/frontend/stripe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { enabled: true } }),
      });
    });

    await openOrganizationSettings(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.DEFAULT_CURRENCY_SELECT).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.defaultCurrencyOption(targetCurrency)).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.DEFAULT_CURRENCY_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).defaultCourseCurrency)
      .toBe(targetCurrency);
  });
});

test("admin can change the age limit and clear it back to no age limit", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettings = await getGlobalSettings(apiClient);
    const targetAgeLimit = originalSettings.ageLimit === 13 ? 16 : 13;

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateAgeLimit({ ageLimit: originalSettings.ageLimit });
    });

    await openOrganizationSettings(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SELECT).click();
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.ageLimitOption(JSON.stringify(targetAgeLimit)))
      .click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SAVE).click();

    await expect
      .poll(async () => (await getGlobalSettings(apiClient)).ageLimit)
      .toBe(targetAgeLimit);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SELECT).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.ageLimitOption("null")).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.AGE_LIMIT_SAVE).click();

    await expect.poll(async () => (await getGlobalSettings(apiClient)).ageLimit).toBe(null);
  });
});
