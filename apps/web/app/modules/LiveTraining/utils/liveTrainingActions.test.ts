import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  PERMISSIONS,
} from "@repo/shared";

import { deriveLiveTrainingUiActions } from "./liveTrainingActions";

import type { LiveTrainingDetails } from "~/modules/LiveTraining/liveTraining.types";

const liveTraining = {
  authorId: "author-id",
  hostIds: [],
  status: LIVE_TRAINING_STATUSES.SCHEDULED,
  deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
  currentSession: null,
} as unknown as LiveTrainingDetails;

describe("deriveLiveTrainingUiActions", () => {
  it("blocks editing while a session is waiting or active", () => {
    const actions = deriveLiveTrainingUiActions({
      liveTraining: {
        ...liveTraining,
        currentSession: { status: LIVE_TRAINING_SESSION_STATUSES.ACTIVE },
      } as LiveTrainingDetails,
      currentUserId: "author-id",
      permissions: [
        PERMISSIONS.LIVE_TRAINING_UPDATE,
        PERMISSIONS.LIVE_TRAINING_DELETE,
        PERMISSIONS.USER_MANAGE,
      ],
    });

    expect(actions.canShowEdit).toBe(false);
    expect(actions.canShowDelete).toBe(false);
    expect(actions.canEditMaterials).toBe(false);
    expect(actions.canManagePeople).toBe(false);
  });

  it("allows Group Managers to view scoped session data without session management actions", () => {
    const actions = deriveLiveTrainingUiActions({
      liveTraining,
      currentUserId: "manager-id",
      permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
    });

    expect(actions.canViewSessionData).toBe(true);
    expect(actions.canManageSession).toBe(false);
    expect(actions.canShowStart).toBe(false);
    expect(actions.canShowFinish).toBe(false);
  });

  it("does not expose session data to a learner with read-only training access", () => {
    const actions = deriveLiveTrainingUiActions({
      liveTraining,
      currentUserId: "learner-id",
      permissions: [PERMISSIONS.LIVE_TRAINING_READ],
    });

    expect(actions.canViewSessionData).toBe(false);
  });
});
