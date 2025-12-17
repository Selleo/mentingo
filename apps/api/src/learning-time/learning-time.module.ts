import { Module } from "@nestjs/common";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { LearningTimeService } from "src/learning-time/learning-time.service";
import { LearningTimeWorker } from "src/learning-time/learning-time.worker";

@Module({
  providers: [LearningTimeService, LearningTimeRepository, LearningTimeWorker],
  exports: [LearningTimeService],
})
export class LearningTimeModule {}
