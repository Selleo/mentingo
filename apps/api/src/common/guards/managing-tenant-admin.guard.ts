import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { hasPermission } from "src/common/permissions/permission.utils";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ManagingTenantAdminGuard implements CanActivate {
  constructor(@Inject(DB_ADMIN) private readonly dbBase: DatabasePg) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as CurrentUserType | undefined;

    if (!user) throw new UnauthorizedException("auth.error.unauthenticated");

    if (!hasPermission(user.permissions, PERMISSIONS.TENANT_MANAGE)) {
      throw new ForbiddenException("auth.error.missingPermission");
    }

    const [tenant] = await this.dbBase
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (!tenant?.isManaging) {
      throw new ForbiddenException("superAdminTenants.error.managingTenantRequired");
    }

    return true;
  }
}
