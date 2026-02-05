import { Module } from "@nestjs/common";

import { TenantsModule } from "src/super-admin/tenants.module";

@Module({
  imports: [TenantsModule],
})
export class SuperAdminModule {}
