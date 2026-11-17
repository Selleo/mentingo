import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { assertContentNavLinkFlow } from "../../flows/navigation/assert-content-nav-link.flow";
import { openFeaturesSettingsFlow } from "../../flows/settings/open-features-settings.flow";
import { togglePlatformFeatureFlow } from "../../flows/settings/toggle-platform-feature.flow";
import { overrideContentModuleState } from "../../utils/content-features";

import { expect, test } from "./articles.fixture";

test("admin toggles Articles in platform settings and the Articles nav entry follows", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await overrideContentModuleState(workerTenantApiClient, "articles", { enabled: true }),
  );
  // Keeps the Content nav group rendered while Articles is off.
  cleanup.add(await overrideContentModuleState(workerTenantApiClient, "news", { enabled: true }));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openFeaturesSettingsFlow(page);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH)).toBeEnabled();

    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.ARTICLES_ENABLED_SWITCH);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH)).toBeDisabled();
    await assertContentNavLinkFlow(page, NAVIGATION_HANDLES.ARTICLES_LINK, { visible: false });

    await openFeaturesSettingsFlow(page);
    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.ARTICLES_ENABLED_SWITCH);
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH)).toBeEnabled();
    await assertContentNavLinkFlow(page, NAVIGATION_HANDLES.ARTICLES_LINK, { visible: true });
  });
});
