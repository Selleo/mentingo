import { Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { GroupModule } from "src/group/group.module";
import { PermissionModule } from "src/permission/permission.module";
import { UserModule } from "src/user/user.module";

import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { IntegrationAdminController } from "./integration-admin.controller";
import { IntegrationController } from "./integration.controller";
import { IntegrationRepository } from "./integration.repository";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [UserModule, GroupModule, CourseModule, PermissionModule],
  controllers: [IntegrationController, IntegrationAdminController],
  providers: [IntegrationService, IntegrationRepository, IntegrationApiKeyGuard],
})
export class IntegrationModule {}
