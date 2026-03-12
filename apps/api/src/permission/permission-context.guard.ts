import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";

import { PermissionService } from "./permission.service";

@Injectable()
export class PermissionContextGuard implements CanActivate {
  constructor(private readonly permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId || !user?.tenantId) return true;

    const permissionContext = await this.permissionService.getPermissionContext(
      user.userId,
      user.tenantId,
      {
        isSupportMode: Boolean(user.isSupportMode),
      },
    );

    request.user = {
      ...user,
      ...permissionContext,
    };

    return true;
  }
}
