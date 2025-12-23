import { Module } from "@nestjs/common";

import { LearningTimeRepository } from "src/learning-time/learning-time.repository";
import { LearningTimeService } from "src/learning-time/learning-time.service";
import { LearningTimeWorker } from "src/learning-time/learning-time.worker";
import { S3Module } from "src/s3/s3.module";

@Module({
  imports: [S3Module],
  providers: [LearningTimeService, LearningTimeRepository, LearningTimeWorker],
  exports: [LearningTimeService, LearningTimeRepository],
})
export class LearningTimeModule {}
