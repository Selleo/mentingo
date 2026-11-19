import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_FORM_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCalendarCreateLiveTrainingDialogFlow } from "../../flows/live-training/open-calendar-create-live-training-dialog.flow";
import { openCalendarFlow } from "../../flows/live-training/open-calendar.flow";
import { getTomorrowDate } from "../../utils/calendar-dates";

test("online delivery cannot be selected when LiveKit is not configured", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveKitConfiguredResponse = await apiClient.api.envControllerGetLiveKitConfigured();

    test.skip(
      liveKitConfiguredResponse.data.data.enabled,
      "LiveKit is configured in this environment.",
    );

    cleanup.add(await factories.createLiveTrainingFactory().ensureLiveTrainingEnabled());

    await openCalendarFlow(page);
    await openCalendarCreateLiveTrainingDialogFlow(page, getTomorrowDate());

    const deliverySelect = page.getByTestId(
      LIVE_TRAINING_FORM_HANDLES.deliveryTypeSelect("calendar-live-training"),
    );
    const onlineOption = page.getByTestId(
      LIVE_TRAINING_FORM_HANDLES.deliveryTypeOption(LIVE_TRAINING_DELIVERY_TYPES.ONLINE),
    );

    await deliverySelect.click();
    await expect(onlineOption).toHaveAttribute("aria-disabled", "true");
    // In-person delivery stays the selected default.
    await expect(
      page.getByTestId(
        LIVE_TRAINING_FORM_HANDLES.deliveryTypeOption(LIVE_TRAINING_DELIVERY_TYPES.OFFLINE),
      ),
    ).toHaveAttribute("data-state", "checked");
  });
});
