import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";

test("content creator cannot assign additional Live Training hosts from the workspace", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  let liveTrainingId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `content-creator-hosts-${Date.now()}`,
    });

    liveTrainingId = liveTraining.id;

    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        try {
          await liveTrainingFactory.delete(liveTrainingId);
        } catch {
          return;
        }
      });
    });
  });

  await withWorkerPage(USER_ROLE.contentCreator, async ({ page }) => {
    await openLiveTrainingFlow(page, liveTrainingId);
    await page.getByTestId(LIVE_TRAINING_HANDLES.OVERVIEW_TAB).click();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.ADD_HOST_BUTTON)).toHaveCount(0);
  });
});
