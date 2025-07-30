import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LessonModule } from "src/lesson/lesson.module";

import { AdminChapterService } from "./adminChapter.service";
import { ChapterController } from "./chapter.controller";
import { ChapterService } from "./chapter.service";
import { AdminChapterRepository } from "./repositories/adminChapter.repository";
import { ChapterRepository } from "./repositories/chapter.repository";

@Module({
  imports: [FileModule, LessonModule],
  controllers: [ChapterController],
  providers: [ChapterService, AdminChapterService, ChapterRepository, AdminChapterRepository],
  exports: [ChapterRepository, AdminChapterService, AdminChapterRepository],
})
export class ChapterModule {}
