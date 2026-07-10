import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from "src/common/decorators/allow-password-change-required.decorator";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { credentials } from "src/storage/schema";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);
    const isAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isAllowed) return true;

    const request = context.switchToHttp().getRequest();
    const currentUser = request.user as CurrentUserType | null;

    if (!currentUser || currentUser.isSupportMode) return true;

    const [credential] = await this.dbAdmin
      .select({ requiresPasswordChange: credentials.requiresPasswordChange })
      .from(credentials)
      .where(
        and(
          eq(credentials.userId, currentUser.userId),
          eq(credentials.tenantId, currentUser.tenantId),
        ),
      )
      .limit(1);

    if (!credential?.requiresPasswordChange) return true;

    throw new ForbiddenException("auth.error.passwordChangeRequired");
  }
}
