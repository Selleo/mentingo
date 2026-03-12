import { Module } from "@nestjs/common";

import { PermissionsService } from "./permissions.service";

@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
