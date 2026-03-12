import { Module } from "@nestjs/common";

import { PermissionContextGuard } from "./permission-context.guard";
import { PermissionsGuard } from "./permission.guard";
import { PermissionService } from "./permission.service";

@Module({
  providers: [PermissionService, PermissionContextGuard, PermissionsGuard],
  exports: [PermissionService, PermissionContextGuard, PermissionsGuard],
})
export class PermissionModule {}
