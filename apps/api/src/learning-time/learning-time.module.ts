import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { LearningTimeService } from "src/learning-time/learning-time.service";
import { LearningTimeWorker } from "src/learning-time/learning-time.worker";
import { LocalizationModule } from "src/localization/localization.module";

@Module({
  imports: [FileModule, LocalizationModule],
  providers: [LearningTimeService, LearningTimeRepository, LearningTimeWorker],
  exports: [LearningTimeService, LearningTimeRepository],
})
export class LearningTimeModule {}
