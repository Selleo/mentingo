import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_FORM_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCalendarCreateLiveTrainingDialogFlow } from "../../flows/live-training/open-calendar-create-live-training-dialog.flow";
import { openCalendarFlow } from "../../flows/live-training/open-calendar.flow";

test("online delivery cannot be selected when LiveKit is not configured", async ({
  apiClient,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await factories.createLiveTrainingFactory().ensureLiveTrainingEnabled();

    const liveKitConfiguredResponse = await apiClient.api.envControllerGetLiveKitConfigured();

    test.skip(
      liveKitConfiguredResponse.data.data.enabled,
      "LiveKit is configured in this environment.",
    );

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await openCalendarFlow(page);
    await openCalendarCreateLiveTrainingDialogFlow(page, tomorrow.toISOString().slice(0, 10));

    const deliverySelect = page.getByTestId(
      LIVE_TRAINING_FORM_HANDLES.deliveryTypeSelect("calendar-live-training"),
    );

    await expect(deliverySelect).toContainText(/offline/i);
    await deliverySelect.click();
    await expect(
      page.getByTestId(
        LIVE_TRAINING_FORM_HANDLES.deliveryTypeOption(LIVE_TRAINING_DELIVERY_TYPES.ONLINE),
      ),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(deliverySelect).toContainText(/offline/i);
  });
});
