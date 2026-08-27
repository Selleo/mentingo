import { Module } from "@nestjs/common";

import { AuditController } from "./audit.controller";
import { AuditRepository } from "./audit.repository";
import { AuditService } from "./audit.service";
import { SchoolTenantGuard } from "./school-tenant.guard";

@Module({
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, SchoolTenantGuard],
})
export class AuditModule {}
