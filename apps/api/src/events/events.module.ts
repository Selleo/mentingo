import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { FileModule } from "src/file/files.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StatisticsService } from "src/statistics/statistics.service";
import { NotifyAdminsHandler } from "src/user/handlers/notify-admins.handler";
import { UserModule } from "src/user/user.module";
import { UserService } from "src/user/user.service";

@Global()
@Module({
  imports: [CqrsModule, UserModule, EmailModule, FileModule, S3Module, StatisticsModule],
  exports: [CqrsModule],
  providers: [NotifyAdminsHandler, UserService, FileService, S3Service, StatisticsService],
})
export class EventsModule {}
