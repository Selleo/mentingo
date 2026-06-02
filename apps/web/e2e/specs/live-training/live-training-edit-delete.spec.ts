import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";

test("admin can inline edit and delete an unlinked Live Training", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `edit-delete-${Date.now()}`,
      description: "Initial description",
      location: "Initial room",
      maxParticipants: 10,
    });
    const updatedTitle = `${liveTraining.title} updated`;
    const updatedDescription = "Updated description";
    const updatedLocation = "Updated room";

    cleanup.add(async () => {
      try {
        await liveTrainingFactory.delete(liveTraining.id);
      } catch {
        return;
      }
    });

    await openLiveTrainingFlow(page, liveTraining.id);

    await page.getByTestId(LIVE_TRAINING_HANDLES.TITLE_INPUT).fill(updatedTitle);
    await page.getByTestId(LIVE_TRAINING_HANDLES.TITLE_INPUT).blur();
    await expect
      .poll(async () => liveTrainingFactory.get(liveTraining.id), { timeout: 15_000 })
      .toMatchObject({ title: updatedTitle });

    await page.getByTestId(LIVE_TRAINING_HANDLES.DESCRIPTION_INPUT).fill(updatedDescription);
    await page.getByTestId(LIVE_TRAINING_HANDLES.DESCRIPTION_INPUT).blur();
    await expect
      .poll(async () => liveTrainingFactory.get(liveTraining.id), { timeout: 15_000 })
      .toMatchObject({ description: updatedDescription });

    await page.getByTestId(LIVE_TRAINING_HANDLES.MAX_PARTICIPANTS_INPUT).fill("42");
    await page.getByTestId(LIVE_TRAINING_HANDLES.MAX_PARTICIPANTS_INPUT).blur();
    await expect
      .poll(async () => liveTrainingFactory.get(liveTraining.id), { timeout: 15_000 })
      .toMatchObject({ maxParticipants: 42 });

    await page.getByTestId(LIVE_TRAINING_HANDLES.LOCATION_INPUT).fill(updatedLocation);
    await page.getByTestId(LIVE_TRAINING_HANDLES.LOCATION_INPUT).blur();
    await expect
      .poll(async () => liveTrainingFactory.get(liveTraining.id), { timeout: 15_000 })
      .toMatchObject({
        title: updatedTitle,
        description: updatedDescription,
        location: updatedLocation,
        maxParticipants: 42,
      });

    await page.getByTestId(LIVE_TRAINING_HANDLES.DELETE_BUTTON).click();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.DELETE_DIALOG)).toBeVisible();
    await page.getByTestId(LIVE_TRAINING_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();

    await expect(page).toHaveURL(/\/calendar$/);
    await expect
      .poll(
        async () => {
          try {
            await liveTrainingFactory.get(liveTraining.id);
            return "visible";
          } catch {
            return "deleted";
          }
        },
        { timeout: 15_000 },
      )
      .toBe("deleted");
  });
});
