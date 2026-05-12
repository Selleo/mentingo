import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "~/common/permissions/permission.utils";

import type { LearningPathEditorLearningPath } from "../types";
import type { PermissionKey } from "~/common/permissions/permission.utils";

type UseLearningPathEditorPermissionsParams = {
  learningPath: LearningPathEditorLearningPath | null;
  currentUserId?: string;
  permissions: PermissionKey[];
  isCreateMode: boolean;
};

export function useLearningPathEditorPermissions({
  learningPath,
  currentUserId,
  permissions,
  isCreateMode,
}: UseLearningPathEditorPermissionsParams) {
  const isOwnLearningPath = learningPath?.authorId === currentUserId;
  const canCreateLearningPaths = hasPermission(permissions, PERMISSIONS.LEARNING_PATH_CREATE);
  const canEdit =
    (isCreateMode && canCreateLearningPaths) ||
    hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE) ||
    (hasPermission(permissions, PERMISSIONS.LEARNING_PATH_UPDATE_OWN) && isOwnLearningPath);
  const canUpdateCourses =
    hasPermission(permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE) ||
    (hasPermission(permissions, PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN) && isOwnLearningPath);

  return {
    canEdit,
    canUpdateCourses,
  };
}
