import { Module } from "@nestjs/common";

import { ContentMarketplaceModule } from "src/content-marketplace/content-marketplace.module";
import { CourseDurationModule } from "src/courses/course-duration.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { GroupModule } from "src/group/group.module";
import { LocalizationModule } from "src/localization/localization.module";
import { NativeArchiveModule } from "src/native-archive/native-archive.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { TenantsModule } from "src/super-admin/tenants.module";
import { UserModule } from "src/user/user.module";

import { IntegrationApiKeyGuard } from "./guards/integration-api-key.guard";
import { IntegrationAdminController } from "./integration-admin.controller";
import { IntegrationContentMarketplaceController } from "./integration-content-marketplace.controller";
import { IntegrationCoursesController } from "./integration-courses.controller";
import { IntegrationNativeArchiveController } from "./integration-native-archive.controller";
import { IntegrationController } from "./integration.controller";
import { IntegrationRepository } from "./integration.repository";
import { IntegrationService } from "./integration.service";
import { IntegrationCourseRepository } from "./repositories/integration-course.repository";
import { IntegrationContentMarketplaceConnectionService } from "./services/integration-content-marketplace-connection.service";
import { IntegrationCourseCatalogService } from "./services/integration-course-catalog.service";
import { IntegrationCourseExportService } from "./services/integration-course-export.service";

@Module({
  imports: [
    UserModule,
    GroupModule,
    CourseModule,
    CourseDurationModule,
    PermissionsModule,
    LocalizationModule,
    TenantsModule,
    FileModule,
    NativeArchiveModule,
    ContentMarketplaceModule,
  ],
  controllers: [
    IntegrationController,
    IntegrationCoursesController,
    IntegrationNativeArchiveController,
    IntegrationContentMarketplaceController,
    IntegrationAdminController,
  ],
  providers: [
    IntegrationService,
    IntegrationRepository,
    IntegrationCourseRepository,
    IntegrationCourseCatalogService,
    IntegrationCourseExportService,
    IntegrationContentMarketplaceConnectionService,
    IntegrationApiKeyGuard,
  ],
})
export class IntegrationModule {}
