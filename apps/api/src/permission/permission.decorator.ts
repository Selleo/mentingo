import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "./permission.constants";

export const REQUIRE_PERMISSION_METADATA_KEY = "requiredPermission";

export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRE_PERMISSION_METADATA_KEY, permission);
