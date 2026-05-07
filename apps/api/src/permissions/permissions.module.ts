import { Module } from "@nestjs/common";

import { PermissionsBackfillService } from "./permissions-backfill.service";
import { PermissionsService } from "./permissions.service";

@Module({
  providers: [PermissionsService, PermissionsBackfillService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
