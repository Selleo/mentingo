import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { selectInterfaceLanguageFlow } from "../../flows/settings/select-interface-language.flow";

test("user switches the interface language, sees localized navigation and keeps it after reload", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const getUserLanguage = async () =>
      (await apiClient.api.settingsControllerGetUserSettings()).data.data?.language;
    const originalLanguage = await getUserLanguage();

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateUserSettings({
        language: originalLanguage ?? SUPPORTED_LANGUAGES.EN,
      });
    });

    await openSettingsPageFlow(page);
    await selectInterfaceLanguageFlow(page, SUPPORTED_LANGUAGES.DE);

    await expect(page.locator("html")).toHaveAttribute("lang", SUPPORTED_LANGUAGES.DE);
    await expect.poll(getUserLanguage).toBe(SUPPORTED_LANGUAGES.DE);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", SUPPORTED_LANGUAGES.DE);

    await prepareNavigationPageFlow(page);
    await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveText("Kurse");
    await expect(page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE)).toHaveText("Verwalten");

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await expect(page.getByTestId(NAVIGATION_HANDLES.SETTINGS_LINK)).toHaveText("Einstellungen");
  });
});
