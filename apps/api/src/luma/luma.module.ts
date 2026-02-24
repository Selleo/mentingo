import { Module } from "@nestjs/common";

import { ChapterModule } from "src/chapter/chapter.module";
import { LessonModule } from "src/lesson/lesson.module";

import { LumaController } from "./luma.controller";
import { LumaService } from "./luma.service";

@Module({
  imports: [LessonModule, ChapterModule],
  providers: [LumaService],
  controllers: [LumaController],
  exports: [LumaService],
})
export class LumaModule {}
