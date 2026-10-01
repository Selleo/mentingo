import { Module } from "@nestjs/common";

import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { EmailTemplateRenderingModule } from "src/email-templates/email-template-rendering.module";
import { UserModule } from "src/user/user.module";

import { TenantsController } from "./tenants.controller";
import { TenantsRepository } from "./tenants.repository";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [UserModule, EmailTemplateRenderingModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, ManagingTenantAdminGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
