import { Module } from "@nestjs/common";

import { ChapterModule } from "src/chapter/chapter.module";
import { ChapterService } from "src/chapter/chapter.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { UserModule } from "src/user/user.module";
import { UserService } from "src/user/user.service";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [EmailModule, FileModule, S3Module, UserModule, ChapterModule, LessonModule],
  controllers: [SettingsController],
  providers: [SettingsService, UserService, FileService, S3Service, ChapterService],
})
export class SettingsModule {}
