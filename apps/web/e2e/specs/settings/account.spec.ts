import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

test("user can change interface language and it persists after reload", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const originalSettings = await apiClient.api.settingsControllerGetUserSettings();
    const originalLanguage = originalSettings.data.data?.language ?? "en";

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateUserSettings({ language: originalLanguage });
    });

    await apiClient.api.settingsControllerUpdateUserSettings({ language: "en" });
    await openSettingsPageFlow(page);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByRole("option", { name: "Polish" }).click();

    await expect
      .poll(async () => {
        const response = await apiClient.api.settingsControllerGetUserSettings();
        return response.data.data?.language;
      })
      .toBe("pl");

    await page.reload();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.LANGUAGE_SELECT)).toContainText("Polski");
  });
});
