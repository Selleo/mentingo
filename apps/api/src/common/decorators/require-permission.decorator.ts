import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "@repo/shared";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";

export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
