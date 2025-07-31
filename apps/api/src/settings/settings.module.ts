import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { FileModule } from "src/file/files.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { UserService } from "src/user/user.service";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [EmailModule, FileModule, S3Module, BunnyStreamModule],
  controllers: [SettingsController],
  providers: [SettingsService, UserService, FileService, S3Service, BunnyStreamService],
})
export class SettingsModule {}
