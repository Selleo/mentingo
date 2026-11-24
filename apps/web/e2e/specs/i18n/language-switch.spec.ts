import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { selectInterfaceLanguageFlow } from "../../flows/settings/select-interface-language.flow";
import { getUserLanguage } from "../../utils/user-settings";

for (const role of [USER_ROLE.admin, USER_ROLE.student]) {
  test(`${role} switches the interface language, sees localized navigation and keeps it after reload`, async ({
    apiClient,
    cleanup,
    withWorkerPage,
  }) => {
    await withWorkerPage(role, async ({ page }) => {
      const originalLanguage = await getUserLanguage(apiClient);

      cleanup.add(async () => {
        await apiClient.api.settingsControllerUpdateUserSettings({
          language: originalLanguage ?? SUPPORTED_LANGUAGES.EN,
        });
      });

      await openSettingsPageFlow(page);
      await selectInterfaceLanguageFlow(page, SUPPORTED_LANGUAGES.DE);

      await expect(page.locator("html")).toHaveAttribute("lang", SUPPORTED_LANGUAGES.DE);
      await expect.poll(() => getUserLanguage(apiClient)).toBe(SUPPORTED_LANGUAGES.DE);

      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", SUPPORTED_LANGUAGES.DE);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT)).toHaveText("Deutsch");

      await prepareNavigationPageFlow(page);
      await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveText("Kurse");

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await expect(page.getByTestId(NAVIGATION_HANDLES.SETTINGS_LINK)).toHaveText("Einstellungen");
      await page.getByTestId(NAVIGATION_HANDLES.SETTINGS_LINK).click();
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT)).toHaveText("Deutsch");
    });
  });
}
