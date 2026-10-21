import { ForbiddenException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";

import type { IntegrationKeyTenantContext } from "../integration.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

/**
 * Course catalogs and exports read another tenant's content, so they need a managing-tenant key
 * whose owner may export courses. The key itself authorizes the read; per-course editing rights
 * in the selected tenant are not required.
 */
export function assertCanExportTenantCourses(
  actor: CurrentUserType,
  keyTenant: IntegrationKeyTenantContext,
) {
  if (!keyTenant.isManaging)
    throw new ForbiddenException("superAdminTenants.error.managingTenantRequired");

  if (!hasPermission(actor.permissions, PERMISSIONS.COURSE_EXPORT))
    throw new ForbiddenException("auth.error.missingPermission");
}
