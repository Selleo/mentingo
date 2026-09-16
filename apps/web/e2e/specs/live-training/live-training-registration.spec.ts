import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";

test("a cancellation automatically promotes the first person on the waiting list", async ({
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async (workspace) => {
    const trainingFactory = workspace.factories.createLiveTrainingFactory();
    const training = await trainingFactory.createOffline({ maxParticipants: 1 });
    await workspace.page.goto(`${workspace.origin}/live-training/${training.id}`);
    await workspace.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTRATION_TOGGLE).check();
    await expect
      .poll(async () => (await trainingFactory.get(training.id)).settings.registrationRequired)
      .toBe(true);
    const first = await workspace.createTenantUserWithPasswordAndRole({
      role: USER_ROLE.student,
      firstName: "First",
      lastName: "Participant",
    });
    const second = await workspace.createTenantUserWithPasswordAndRole({
      role: USER_ROLE.student,
      firstName: "Second",
      lastName: "Participant",
    });
    await first.page.goto(`${workspace.origin}/live-training/${training.id}`);
    await first.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTER_BUTTON).click();
    await expect(first.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTRATION_STATUS)).toContainText(
      "confirmed",
    );
    await second.page.goto(`${workspace.origin}/live-training/${training.id}`);
    await second.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTER_BUTTON).click();
    await expect(second.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTRATION_STATUS)).toContainText(
      "1",
    );
    await expect(workspace.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTRATION_LIST)).toContainText(
      "Second Participant",
    );
    await first.page.getByTestId(LIVE_TRAINING_HANDLES.CANCEL_REGISTRATION_BUTTON).click();
    await expect(second.page.getByTestId(LIVE_TRAINING_HANDLES.REGISTRATION_STATUS)).toContainText(
      "confirmed",
      { timeout: 15_000 },
    );
    await expect
      .poll(
        async () =>
          (
            await second.apiClient.api.liveTrainingControllerGetLiveTraining(training.id, {
              language: "en",
            })
          ).data.data.registration,
      )
      .toMatchObject({ registeredCount: 1, waitlistedCount: 0, status: "registered" });
  });
});
