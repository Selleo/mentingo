import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_STATUSES,
  PERMISSIONS,
} from "@repo/shared";

import { hasAnyPermission, hasPermission } from "~/common/permissions/permission.utils";

import type {
  LiveTrainingActionContext,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";

const TERMINAL_LIVE_TRAINING_STATUSES = [
  LIVE_TRAINING_STATUSES.ENDED,
  LIVE_TRAINING_STATUSES.CANCELLED,
  LIVE_TRAINING_STATUSES.EXPIRED,
] as const;

const BROAD_LIVE_TRAINING_MANAGE_PERMISSIONS = [
  PERMISSIONS.LIVE_TRAINING_UPDATE,
  PERMISSIONS.LIVE_TRAINING_DELETE,
  PERMISSIONS.LIVE_TRAINING_STATISTICS,
] as const;

const isTerminalLiveTrainingStatus = (status: string) =>
  TERMINAL_LIVE_TRAINING_STATUSES.some((terminalStatus) => terminalStatus === status);

export const deriveLiveTrainingUiActions = ({
  liveTraining,
  currentUserId,
  permissions,
}: LiveTrainingActionContext): LiveTrainingUiActions => {
  const trainerIds = new Set(liveTraining.trainerIds);
  const isAuthor = liveTraining.authorId === currentUserId;
  const isTrainer = trainerIds.has(currentUserId);
  const isManager = isAuthor || isTrainer;
  const hasBroadManagePermission = hasAnyPermission(permissions, BROAD_LIVE_TRAINING_MANAGE_PERMISSIONS);
  const canUpdateAny = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_UPDATE);
  const canUpdateOwn = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN) && isAuthor;
  const canOperateSession = isManager || canUpdateAny || hasBroadManagePermission;
  const isActiveSession = liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE;
  const isScheduled = liveTraining.status === LIVE_TRAINING_STATUSES.SCHEDULED;
  const isJoinable =
    liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE &&
    liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE &&
    !isTerminalLiveTrainingStatus(liveTraining.status);

  return {
    canShowEdit: canUpdateAny || canUpdateOwn,
    canShowDelete: hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_DELETE),
    canShowStart:
      hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_START) && canOperateSession && isScheduled,
    canShowJoin: hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_JOIN) && isJoinable,
    canShowFinish:
      hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_END) && canOperateSession && isActiveSession,
    canShowStatistics: hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_STATISTICS),
  };
};
