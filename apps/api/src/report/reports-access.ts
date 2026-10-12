import { ForbiddenException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";

import { REPORT_SCOPE, type ReportScope } from "./constants/reports.constants";
import { REPORT_ERRORS } from "./constants/reports.errors";

import type { ReportsAccess, ReportsScopeHashes } from "./reports-access.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type { ReportsAccess } from "./reports-access.types";

/** Pure permission calculation shared by report execution and saved-report governance. */
export function getReportsAccess(actor: CurrentUserType): ReportsAccess {
  const hasReportRead = hasPermission(actor.permissions, PERMISSIONS.REPORT_READ);
  const hasManagedResults = hasPermission(
    actor.permissions,
    PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
  );
  const hasCourseUpdate = hasPermission(actor.permissions, PERMISSIONS.COURSE_UPDATE);
  const hasCourseUpdateOwn = hasPermission(actor.permissions, PERMISSIONS.COURSE_UPDATE_OWN);
  const ownedCoursesOnly = hasReportRead && hasCourseUpdateOwn && !hasCourseUpdate;

  return {
    tenantId: actor.tenantId,
    userId: actor.userId,
    canReadOrganisation: hasReportRead && !ownedCoursesOnly,
    canReadManagedGroups: hasManagedResults,
    ownedCoursesOnly,
    canManageShared: hasReportRead && (!hasCourseUpdateOwn || hasCourseUpdate),
  };
}

export function assertCanReadReports(actor: CurrentUserType): ReportsAccess {
  const access = getReportsAccess(actor);
  if (getReportsScopes(access).length === 0) {
    throw new ForbiddenException(REPORT_ERRORS.ACCESS_DENIED);
  }

  return access;
}

export function reportsAccessFingerprint(
  access: ReportsAccess,
  managedGroupIds: readonly string[],
  liveScopeHashes: ReportsScopeHashes = {},
): string {
  return JSON.stringify({
    tenantId: access.tenantId,
    userId: access.userId,
    canReadOrganisation: access.canReadOrganisation,
    canReadManagedGroups: access.canReadManagedGroups,
    ownedCoursesOnly: access.ownedCoursesOnly,
    canManageShared: access.canManageShared,
    managedGroupIds: [...managedGroupIds].sort(),
    managedLearnersHash: liveScopeHashes.managedLearnersHash ?? "",
    ownedCoursesHash: liveScopeHashes.ownedCoursesHash ?? "",
    ownedEnrollmentsHash: liveScopeHashes.ownedEnrollmentsHash ?? "",
  });
}

/** Scopes are additive: a creator can also manage a learner group. */
export function getReportsScopes(access: ReportsAccess): ReportScope[] {
  const scopes: ReportScope[] = [];
  if (access.canReadOrganisation) scopes.push(REPORT_SCOPE.ORGANISATION);
  if (access.canReadManagedGroups) scopes.push(REPORT_SCOPE.MANAGED_GROUPS);
  if (access.ownedCoursesOnly) scopes.push(REPORT_SCOPE.OWN_COURSES);
  return scopes;
}
