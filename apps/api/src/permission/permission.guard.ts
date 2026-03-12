import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { REQUIRE_PERMISSION_METADATA_KEY } from "./permission.decorator";

import type { PermissionKey } from "./permission.constants";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(
      REQUIRE_PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new UnauthorizedException("auth.error.unauthenticated");

    if (!Array.isArray(user.permissions))
      throw new ForbiddenException("permission.error.contextMissing");

    if (!user.permissions.includes(permission))
      throw new ForbiddenException("permission.error.insufficientPermission");

    return true;
  }
}
