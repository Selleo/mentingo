import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";

import { PublicCourseThumbnailController } from "./public-course-thumbnail.controller";
import { PublicCourseThumbnailService } from "./public-course-thumbnail.service";

@Module({
  imports: [FileModule],
  controllers: [PublicCourseThumbnailController],
  providers: [PublicCourseThumbnailService],
})
export class PublicCourseThumbnailModule {}
