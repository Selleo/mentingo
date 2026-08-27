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

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class SchoolTenantGuard implements CanActivate {
  constructor(@Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserType | undefined;

    if (!user) throw new UnauthorizedException("auth.error.unauthenticated");

    const [tenant] = await this.dbAdmin
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (!tenant || tenant.isManaging) {
      throw new ForbiddenException("auditView.errors.schoolTenantRequired");
    }

    return true;
  }
}
