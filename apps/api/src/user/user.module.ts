import { Module } from "@nestjs/common";

import { CreatePasswordService } from "src/auth/create-password.service";
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

import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [EmailModule, FileModule, S3Module, BunnyStreamModule, StatisticsModule, SettingsModule],
  controllers: [UserController],
  providers: [
    UserService,
    FileService,
    S3Service,
    BunnyStreamService,
    StatisticsService,
    CreatePasswordService,
  ],
  exports: [UserService, StatisticsService],
})
export class UserModule {}
