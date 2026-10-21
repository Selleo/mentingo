import { NotFoundException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";

import type { IntegrationKeyTenantContext } from "../integration.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

export function assertCanManageTenants(
  actor: CurrentUserType,
  keyTenant: IntegrationKeyTenantContext,
) {
  if (!hasPermission(actor.permissions, PERMISSIONS.TENANT_MANAGE)) {
    throw new NotFoundException("auth.error.missingPermission");
  }

  if (!keyTenant.isManaging) {
    throw new NotFoundException("superAdminTenants.error.managingTenantRequired");
  }
}
