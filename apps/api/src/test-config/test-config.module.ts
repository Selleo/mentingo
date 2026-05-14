import { Module } from "@nestjs/common";

import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { TestConfigController } from "./api/test-config.controller";
import { TestConfigService } from "./test-config.service";

@Module({
  imports: [StudentLessonProgressModule],
  controllers: [TestConfigController],
  providers: [TestConfigService],
  exports: [],
})
export class TestConfigModule {}
