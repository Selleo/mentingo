import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { FileService } from "src/file/file.service";
import { S3Service } from "src/s3/s3.service";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [EmailModule],
  controllers: [UserController],
  providers: [UserService, FileService, S3Service],
  exports: [],
})
export class UserModule {}
