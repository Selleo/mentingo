import type { GetLiveTrainingResponse } from "~/api/generated-api";
import type { PermissionKey } from "~/common/permissions/permission.utils";

export type LiveTrainingDetails = GetLiveTrainingResponse["data"];

export type LiveTrainingUiActions = {
  canShowEdit: boolean;
  canShowDelete: boolean;
  canShowStart: boolean;
  canShowJoin: boolean;
  canShowFinish: boolean;
  canShowStatistics: boolean;
  canEditMaterials: boolean;
  canManagePeople: boolean;
  canManageSession: boolean;
  canViewAllMaterials: boolean;
  canViewSessionData: boolean;
};

export type LiveTrainingActionContext = {
  liveTraining: LiveTrainingDetails;
  currentUserId: string;
  permissions: PermissionKey[];
};

export type LiveTrainingPerson = {
  id: string;
  fullName: string | null;
  profilePictureUrl: string | null;
};

export const LIVE_TRAINING_PERSON_ROLES = {
  AUTHOR: "author",
  HOST: "host",
} as const;

export type LiveTrainingPersonRole =
  (typeof LIVE_TRAINING_PERSON_ROLES)[keyof typeof LIVE_TRAINING_PERSON_ROLES];

export type LiveTrainingPersonListItem = {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  roles: LiveTrainingPersonRole[];
};

export const LIVE_TRAINING_FILE_TABS = {
  BEFORE: "before",
  AFTER: "after",
} as const;

export type LiveTrainingFileTab =
  (typeof LIVE_TRAINING_FILE_TABS)[keyof typeof LIVE_TRAINING_FILE_TABS];

export const LIVE_TRAINING_WORKSPACE_TABS = {
  OVERVIEW: "overview",
  FILES: "files",
  SESSIONS: "sessions",
} as const;

export type LiveTrainingWorkspaceTab =
  (typeof LIVE_TRAINING_WORKSPACE_TABS)[keyof typeof LIVE_TRAINING_WORKSPACE_TABS];
