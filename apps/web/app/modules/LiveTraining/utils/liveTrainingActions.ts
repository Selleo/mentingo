import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
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
  PERMISSIONS.LIVE_TRAINING_DELETE_OWN,
  PERMISSIONS.LIVE_TRAINING_STATISTICS,
] as const;

const isTerminalLiveTrainingStatus = (status: string) =>
  TERMINAL_LIVE_TRAINING_STATUSES.some((terminalStatus) => terminalStatus === status);

export const deriveLiveTrainingUiActions = ({
  liveTraining,
  currentUserId,
  permissions,
}: LiveTrainingActionContext): LiveTrainingUiActions => {
  const hostIds = new Set(liveTraining.hostIds);
  const isAuthor = liveTraining.authorId === currentUserId;
  const isHost = hostIds.has(currentUserId);
  const hasHostRole = isAuthor || isHost;
  const hasBroadManagePermission = hasAnyPermission(
    permissions,
    BROAD_LIVE_TRAINING_MANAGE_PERMISSIONS,
  );
  const canUpdateAny = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_UPDATE);
  const canUpdateOwn = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN) && isAuthor;
  const canDeleteAny = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_DELETE);
  const canDeleteOwn = hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_DELETE_OWN) && isAuthor;
  const canEditDetails = canUpdateAny || canUpdateOwn;
  const canManageSession = hasHostRole || hasBroadManagePermission;
  const canViewAllMaterials = hasHostRole || hasBroadManagePermission;
  const canViewSessionData =
    canManageSession || hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_STATISTICS);
  const isActiveSession = liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE;
  const canStartFromStatus =
    liveTraining.status === LIVE_TRAINING_STATUSES.SCHEDULED ||
    liveTraining.status === LIVE_TRAINING_STATUSES.ENDED;
  const currentSession = liveTraining.currentSession;
  const hasOpenSession =
    currentSession?.status === LIVE_TRAINING_SESSION_STATUSES.WAITING ||
    currentSession?.status === LIVE_TRAINING_SESSION_STATUSES.ACTIVE;
  const isJoinable =
    liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE &&
    hasOpenSession &&
    !isTerminalLiveTrainingStatus(liveTraining.status);

  return {
    canShowEdit: canEditDetails,
    canShowDelete: canDeleteAny || canDeleteOwn,
    canShowStart:
      (hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_START) || hasHostRole) &&
      canManageSession &&
      canStartFromStatus &&
      !hasOpenSession,
    canShowJoin: hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_JOIN) && isJoinable,
    canShowFinish:
      (hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_END) || hasHostRole) &&
      canManageSession &&
      (isActiveSession || hasOpenSession),
    canShowStatistics: hasPermission(permissions, PERMISSIONS.LIVE_TRAINING_STATISTICS),
    canEditMaterials: canEditDetails,
    canManagePeople: canEditDetails && hasPermission(permissions, PERMISSIONS.USER_MANAGE),
    canManageSession,
    canViewAllMaterials,
    canViewSessionData,
  };
};
