import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class DisallowInSupportModeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUserType | undefined;

    if (user?.isSupportMode)
      throw new ForbiddenException("supportMode.errors.personalSettingsBlocked");

    return true;
  }
}
