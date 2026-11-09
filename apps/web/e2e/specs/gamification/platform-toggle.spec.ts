import { USER_ROLE } from "~/config/userRoles";

import { GAMIFICATION_ADMIN_HANDLES } from "../../data/gamification-admin/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import { ensureLeaderboardFeatures } from "../../utils/leaderboard-features";

test("platform gamification switch hides navigation and blocks direct routes until enabled again", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, {
      gamificationEnabled: true,
      leaderboardsEnabled: true,
    }),
  );

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    const toggle = page.locator("#gamification-enabled");
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect
      .poll(
        async () =>
          (await workerTenantApiClient.api.settingsControllerGetPublicGlobalSettings()).data.data
            .gamificationEnabled,
      )
      .toBe(false);
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId(NAVIGATION_HANDLES.GAMIFICATION_LINK)).toHaveCount(0);
    await expect(page.getByTestId(NAVIGATION_HANDLES.LEADERBOARDS_LINK)).toHaveCount(0);

    let protectedRequests = 0;
    page.on("request", (request) => {
      if (/\/api\/gamification\/(admin\/achievements|leaderboard)/.test(request.url()))
        protectedRequests++;
    });
    for (const path of [
      "/admin/gamification",
      "/admin/gamification/achievements/new",
      "/admin/gamification/achievements/00000000-0000-4000-8000-000000000001",
      "/leaderboards",
    ]) {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByTestId(GAMIFICATION_ADMIN_HANDLES.PAGE)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId(GAMIFICATION_ADMIN_HANDLES.PAGE)).toHaveCount(0);
    }
    expect(protectedRequests).toBe(0);

    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect
      .poll(
        async () =>
          (await workerTenantApiClient.api.settingsControllerGetPublicGlobalSettings()).data.data
            .gamificationEnabled,
      )
      .toBe(true);
    await prepareNavigationPageFlow(page);
    await page.getByTestId(NAVIGATION_HANDLES.GAMIFICATION_LINK).click();
    await expect(page.getByTestId(GAMIFICATION_ADMIN_HANDLES.PAGE)).toBeVisible();
    await expect(page.locator("#gamification-enabled")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId(GAMIFICATION_ADMIN_HANDLES.PAGE)).toBeVisible();
  });
});
