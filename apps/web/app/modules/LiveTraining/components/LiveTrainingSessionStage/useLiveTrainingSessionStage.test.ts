import { LIVE_TRAINING_DELIVERY_TYPES, LIVE_TRAINING_STATUSES } from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLiveTrainingSessionStage } from "./useLiveTrainingSessionStage";

import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

const editFormState: LiveTrainingEditFormState = {
  title: "Training",
  description: "Description",
  allDay: false,
  startDate: "2026-07-22",
  startTime: "10:00",
  endDate: "2026-07-22",
  endTime: "11:00",
  deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
  location: "Room 1",
  maxParticipants: "10",
  microphoneEnabled: false,
  cameraEnabled: false,
};

describe("useLiveTrainingSessionStage", () => {
  it("commits the current max participants input on blur", () => {
    const onEditFormStateChange = vi.fn();
    const onEditFormStateCommit = vi.fn();
    const { result } = renderHook(() =>
      useLiveTrainingSessionStage({
        liveTraining: {
          title: editFormState.title,
          description: editFormState.description,
          deliveryType: editFormState.deliveryType,
          allDay: editFormState.allDay,
          startsAt: "2026-07-22T10:00:00.000Z",
          endsAt: "2026-07-22T11:00:00.000Z",
          status: LIVE_TRAINING_STATUSES.SCHEDULED,
        } as LiveTrainingDetails,
        actions: { canShowEdit: true } as LiveTrainingUiActions,
        editFormState,
        isOnlineDeliveryAvailable: false,
        onEditFormStateChange,
        onEditFormStateCommit,
      }),
    );

    act(() => result.current.handleMaxParticipantsBlur("42"));

    expect(onEditFormStateChange).toHaveBeenCalledWith("maxParticipants", "42");
    expect(onEditFormStateCommit).toHaveBeenCalledWith({
      ...editFormState,
      maxParticipants: "42",
    });
  });
});
