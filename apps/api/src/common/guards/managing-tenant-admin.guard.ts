import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class ManagingTenantAdminGuard implements CanActivate {
  constructor(@Inject(DB_ADMIN) private readonly dbBase: DatabasePg) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as CurrentUser | undefined;

    if (!user) throw new UnauthorizedException("auth.error.unauthenticated");

    if (user.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException("auth.error.adminRoleRequired");
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
