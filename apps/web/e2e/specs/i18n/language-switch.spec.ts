import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_SELECTORS } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("admin can switch the UI language and see localized navigation", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettingsResponse = await apiClient.api.settingsControllerGetUserSettings();
    const originalLanguage = originalSettingsResponse.data.data?.language;

    cleanup.add(async () => {
      if (originalLanguage)
        await apiClient.api.settingsControllerUpdateUserSettings({
          language: originalLanguage,
        });
    });

    await openSettingsPageFlow(page);

    const languageSelect = page.locator(SETTINGS_PAGE_SELECTORS.LANGUAGE_CARD);

    await languageSelect.getByRole("combobox").click();
    await page.getByRole("option", { name: "German" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "de");

    await prepareNavigationPageFlow(page);

    await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveText("Kurse");
    await expect(page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE)).toHaveText("Verwalten");

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await expect(page.getByTestId(NAVIGATION_HANDLES.SETTINGS_LINK)).toHaveText("Einstellungen");
  });
});

test("admin language selection persists after reload", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalSettingsResponse = await apiClient.api.settingsControllerGetUserSettings();
    const originalLanguage = originalSettingsResponse.data.data?.language;

    cleanup.add(async () => {
      if (originalLanguage)
        await apiClient.api.settingsControllerUpdateUserSettings({
          language: originalLanguage,
        });
    });

    await openSettingsPageFlow(page);

    const languageSelect = page.locator(SETTINGS_PAGE_SELECTORS.LANGUAGE_CARD);

    await languageSelect.getByRole("combobox").click();
    await page.getByRole("option", { name: "Polish" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "pl");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");

    await prepareNavigationPageFlow(page);

    await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveText("Kursy");
    await expect(page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE)).toHaveText("Zarządzaj");
  });
});
