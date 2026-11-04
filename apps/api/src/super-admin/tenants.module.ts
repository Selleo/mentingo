import { Module } from "@nestjs/common";

import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { EmailTemplateRenderingModule } from "src/email-templates/email-template-rendering.module";
import { GamificationModule } from "src/gamification/gamification.module";
import { UserModule } from "src/user/user.module";

import { TenantsController } from "./tenants.controller";
import { TenantsRepository } from "./tenants.repository";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [UserModule, EmailTemplateRenderingModule, GamificationModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, ManagingTenantAdminGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
