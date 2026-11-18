import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { QA_SETTINGS_HANDLES } from "../../data/qa/handles";
import { assertContentNavLinkFlow } from "../../flows/navigation/assert-content-nav-link.flow";
import { openFeaturesSettingsFlow } from "../../flows/settings/open-features-settings.flow";
import { togglePlatformFeatureFlow } from "../../flows/settings/toggle-platform-feature.flow";
import { overrideContentModuleState } from "../../utils/content-features";

import { expect, test } from "./qa.fixture";

test("admin toggles Q&A in platform settings and the Q&A nav entry follows", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(await overrideContentModuleState(workerTenantApiClient, "qa", { enabled: true }));
  // Keeps the Content nav group rendered while Q&A is off.
  cleanup.add(await overrideContentModuleState(workerTenantApiClient, "news", { enabled: true }));

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openFeaturesSettingsFlow(page);
    await expect(page.getByTestId(QA_SETTINGS_HANDLES.PUBLIC_SWITCH)).toBeEnabled();

    await togglePlatformFeatureFlow(page, QA_SETTINGS_HANDLES.ENABLED_SWITCH);
    await expect(page.getByTestId(QA_SETTINGS_HANDLES.PUBLIC_SWITCH)).toBeDisabled();
    await assertContentNavLinkFlow(page, NAVIGATION_HANDLES.QA_LINK, { visible: false });

    await openFeaturesSettingsFlow(page);
    await togglePlatformFeatureFlow(page, QA_SETTINGS_HANDLES.ENABLED_SWITCH);
    await expect(page.getByTestId(QA_SETTINGS_HANDLES.PUBLIC_SWITCH)).toBeEnabled();
    await assertContentNavLinkFlow(page, NAVIGATION_HANDLES.QA_LINK, { visible: true });
  });
});
