import { Module } from "@nestjs/common";

import { BunnyStreamModule } from "src/bunny/bunnyStream.module";
import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { FileModule } from "src/file/files.module";
import { S3Module } from "src/s3/s3.module";
import { S3Service } from "src/s3/s3.service";
import { StatisticsModule } from "src/statistics/statistics.module";
import { StatisticsService } from "src/statistics/statistics.service";

import { BulkUserService } from "./bulk-user.service";
import { ImportValidationService } from "./import-validation.service";
import { UserImportController } from "./user-import.controller";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [EmailModule, FileModule, S3Module, BunnyStreamModule, StatisticsModule],
  controllers: [UserController, UserImportController],
  providers: [
    UserService,
    BulkUserService,
    ImportValidationService,
    FileService,
    S3Service,
    BunnyStreamService,
    StatisticsService,
  ],
  exports: [UserService, BulkUserService, StatisticsService],
})
export class UserModule {}
