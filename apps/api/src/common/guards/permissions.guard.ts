import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { hasAnyPermission } from "src/common/permissions/permission.utils";

import type { PermissionKey } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserType | undefined;

    if (isPublic && !user) return true;

    if (!user) return false;

    const isAllowed = hasAnyPermission(user.permissions, requiredPermissions);

    if (!isAllowed) throw new ForbiddenException("auth.error.missingPermission");

    return true;
  }
}
