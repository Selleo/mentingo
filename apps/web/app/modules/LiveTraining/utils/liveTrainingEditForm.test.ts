import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  buildLiveTrainingEditFormState,
  buildUpdateLiveTrainingPayload,
} from "./liveTrainingEditForm";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

const liveTraining = {
  title: "Quarterly workshop",
  description: null,
  startsAt: new Date("2026-07-10T00:00:00").toISOString(),
  endsAt: new Date("2026-07-13T00:00:00").toISOString(),
  allDay: true,
  timezone: "Europe/Warsaw",
  location: null,
  deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
  maxParticipants: 20,
  settings: {
    viewerPermissions: {
      microphoneEnabled: false,
      cameraEnabled: false,
    },
  },
} as LiveTrainingDetails;

describe("live training edit form", () => {
  it("keeps an all-day end date unchanged when another field is updated", () => {
    const formState = buildLiveTrainingEditFormState(liveTraining);
    const payload = buildUpdateLiveTrainingPayload(
      { ...formState, title: "Updated workshop" },
      liveTraining.timezone,
      "en",
    );

    expect(formState.endDate).toBe("2026-07-12");
    expect(payload.startsAt).toBe(liveTraining.startsAt);
    expect(payload.endsAt).toBe(liveTraining.endsAt);
  });
});
