import { Module } from "@nestjs/common";

import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { UserModule } from "src/user/user.module";

import { TenantsController } from "./tenants.controller";
import { TenantsRepository } from "./tenants.repository";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [UserModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, ManagingTenantAdminGuard],
})
export class TenantsModule {}
