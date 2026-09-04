import { PERMISSIONS } from "@repo/shared";

import { canReadLiveTrainingPage } from "./liveTrainingAccess";

describe("canReadLiveTrainingPage", () => {
  it("allows learners with live-training read access", () => {
    expect(canReadLiveTrainingPage([PERMISSIONS.LIVE_TRAINING_READ], true)).toBe(true);
  });

  it("allows Group Managers to open live-training details", () => {
    expect(canReadLiveTrainingPage([PERMISSIONS.MANAGED_GROUP_RESULTS_READ], true)).toBe(true);
  });

  it("denies access when live training is disabled", () => {
    expect(
      canReadLiveTrainingPage(
        [PERMISSIONS.LIVE_TRAINING_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
        false,
      ),
    ).toBe(false);
  });

  it("denies users without either read permission", () => {
    expect(canReadLiveTrainingPage([PERMISSIONS.CALENDAR_READ], true)).toBe(false);
  });
});
