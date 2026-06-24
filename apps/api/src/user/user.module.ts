import { forwardRef, Module } from "@nestjs/common";

import { CreatePasswordService } from "src/auth/create-password.service";
import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { CourseModule } from "src/courses/course.module";
import { FileModule } from "src/file/files.module";
import { GroupModule } from "src/group/group.module";
import { LocalizationModule } from "src/localization/localization.module";
import { OutboxModule } from "src/outbox/outbox.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StatisticsService } from "src/statistics/statistics.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserImportRepository } from "src/user/repositories/user-import.repository";
import { UserPasswordEmailRepository } from "src/user/repositories/user-password-email.repository";
import { UserImportService } from "src/user/services/user-import.service";
import { UserPasswordEmailService } from "src/user/services/user-password-email.service";
import { UserInactivityEmailCron } from "src/user/user-inactivity-email-cron";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [
    EmailModule,
    FileModule,
    S3Module,
    BunnyStreamModule,
    StatisticsModule,
    SettingsModule,
    GroupModule,
    LocalizationModule,
    OutboxModule,
    forwardRef(() => CourseModule),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserImportService,
    UserPasswordEmailService,
    UserImportRepository,
    UserPasswordEmailRepository,
    S3Service,
    BunnyStreamService,
    StatisticsService,
    CreatePasswordService,
    TenantDbRunnerService,
    UserInactivityEmailCron,
  ],
  exports: [UserService, UserImportService, UserPasswordEmailService, StatisticsService],
})
export class UserModule {}
