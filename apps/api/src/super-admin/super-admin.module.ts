import { Module } from "@nestjs/common";

import { ManagingTenantAdminGuard } from "src/common/guards/managing-tenant-admin.guard";
import { TenantsController } from "src/super-admin/tenants.controller";
import { TenantsService } from "src/super-admin/tenants.service";
import { UserModule } from "src/user/user.module";

@Module({
  imports: [UserModule],
  controllers: [TenantsController],
  providers: [TenantsService, ManagingTenantAdminGuard],
})
export class SuperAdminModule {}
