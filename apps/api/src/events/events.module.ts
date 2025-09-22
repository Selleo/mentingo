import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "src/auth/auth.module";
import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { FileModule } from "src/file/files.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { SettingsModule } from "src/settings/settings.module";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StatisticsService } from "src/statistics/statistics.service";
import { NotifyAdminsHandler } from "src/user/handlers/notify-admins.handler";
import { UserModule } from "src/user/user.module";
import { UserService } from "src/user/user.service";

@Global()
@Module({
  imports: [
    CqrsModule,
    UserModule,
    EmailModule,
    FileModule,
    S3Module,
    BunnyStreamModule,
    StatisticsModule,
    AuthModule,
    SettingsModule,
  ],
  exports: [CqrsModule],
  providers: [
    NotifyAdminsHandler,
    UserService,
    FileService,
    S3Service,
    BunnyStreamService,
    StatisticsService,
  ],
})
export class EventsModule {}
