import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";

test("content creator cannot assign additional Live Training hosts from the workspace", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.contentCreator, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `content-creator-hosts-${Date.now()}`,
    });

    cleanup.add(async () => {
      try {
        await liveTrainingFactory.delete(liveTraining.id);
      } catch {
        return;
      }
    });

    await openLiveTrainingFlow(page, liveTraining.id);
    await page.getByTestId(LIVE_TRAINING_HANDLES.OVERVIEW_TAB).click();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.ADD_HOST_BUTTON)).toHaveCount(0);
  });
});
