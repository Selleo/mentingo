import { COURSE_ENROLLMENT, LIVE_TRAINING_LINK_ENTITY_TYPES, PERMISSIONS } from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";

import { groupManagerGroups } from "src/storage/schema";

import { hasAnyPermission, hasPermission } from "./permission.utils";

import type { PermissionKey } from "@repo/shared";
import type { SQL, SQLWrapper } from "drizzle-orm";
import type { CurrentUserType } from "src/common/types/current-user.type";

export const shouldApplyGroupManagerScope = (
  currentUser: CurrentUserType,
  broadPermissions: PermissionKey[],
): boolean =>
  hasPermission(currentUser.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ) &&
  (broadPermissions.length === 0 || !hasAnyPermission(currentUser.permissions, broadPermissions));

export const getGroupManagerLearnerScopeCondition = (
  currentUser: CurrentUserType,
  learnerId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM group_manager_groups gmg_scope
    INNER JOIN group_users gu_scope ON gu_scope.group_id = gmg_scope.group_id
    WHERE gmg_scope.manager_user_id = ${currentUser.userId}
      AND gmg_scope.tenant_id = ${currentUser.tenantId}
      AND gu_scope.user_id = ${learnerId}
  )`;
};

export const getGroupManagerGroupScopeCondition = (
  currentUser: CurrentUserType,
  groupId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM ${groupManagerGroups}
    WHERE ${and(
      eq(groupManagerGroups.managerUserId, currentUser.userId),
      eq(groupManagerGroups.tenantId, currentUser.tenantId),
      eq(groupManagerGroups.groupId, groupId),
    )}
  )`;
};

export const getGroupManagerCourseScopeCondition = (
  currentUser: CurrentUserType,
  courseId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM student_courses sc_scope
    INNER JOIN group_users gu_scope ON gu_scope.user_id = sc_scope.student_id
    INNER JOIN group_manager_groups gmg_scope ON gmg_scope.group_id = gu_scope.group_id
    WHERE gmg_scope.manager_user_id = ${currentUser.userId}
      AND gmg_scope.tenant_id = ${currentUser.tenantId}
      AND sc_scope.course_id = ${courseId}
      AND sc_scope.status = ${COURSE_ENROLLMENT.ENROLLED}
  )`;
};

export const getGroupManagerLearningPathScopeCondition = (
  currentUser: CurrentUserType,
  learningPathId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM student_learning_paths slp_scope
    INNER JOIN group_users gu_scope ON gu_scope.user_id = slp_scope.student_id
    INNER JOIN group_manager_groups gmg_scope ON gmg_scope.group_id = gu_scope.group_id
    WHERE gmg_scope.manager_user_id = ${currentUser.userId}
      AND gmg_scope.tenant_id = ${currentUser.tenantId}
      AND slp_scope.learning_path_id = ${learningPathId}
  )`;
};

export const getGroupManagerGroupCourseScopeCondition = (
  currentUser: CurrentUserType,
  groupId: SQLWrapper,
  courseId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM group_manager_groups gmg_scope
    INNER JOIN group_users gu_scope ON gu_scope.group_id = gmg_scope.group_id
    INNER JOIN student_courses sc_scope ON sc_scope.student_id = gu_scope.user_id
    WHERE gmg_scope.manager_user_id = ${currentUser.userId}
      AND gmg_scope.tenant_id = ${currentUser.tenantId}
      AND gmg_scope.group_id = ${groupId}
      AND sc_scope.course_id = ${courseId}
      AND sc_scope.status = ${COURSE_ENROLLMENT.ENROLLED}
  )`;
};

export const getGroupManagerLiveTrainingScopeCondition = (
  currentUser: CurrentUserType,
  liveTrainingId: SQLWrapper,
  broadPermissions: PermissionKey[],
): SQL | undefined => {
  if (!shouldApplyGroupManagerScope(currentUser, broadPermissions)) return undefined;

  return sql`EXISTS (
    SELECT 1
    FROM live_training_links ltl_scope
    INNER JOIN student_courses sc_scope ON sc_scope.course_id = ltl_scope.entity_id
    INNER JOIN group_users gu_scope ON gu_scope.user_id = sc_scope.student_id
    INNER JOIN group_manager_groups gmg_scope ON gmg_scope.group_id = gu_scope.group_id
    WHERE ltl_scope.live_training_id = ${liveTrainingId}
      AND ltl_scope.entity_type = ${LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE}
      AND gmg_scope.manager_user_id = ${currentUser.userId}
      AND gmg_scope.tenant_id = ${currentUser.tenantId}
      AND sc_scope.status = ${COURSE_ENROLLMENT.ENROLLED}
  )`;
};
