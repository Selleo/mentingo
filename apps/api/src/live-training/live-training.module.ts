import { Module } from "@nestjs/common";

import { LiveTrainingController } from "./live-training.controller";
import { LiveTrainingRepository } from "./live-training.repository";
import { LiveTrainingService } from "./live-training.service";

@Module({
  controllers: [LiveTrainingController],
  providers: [LiveTrainingService, LiveTrainingRepository],
  exports: [LiveTrainingService, LiveTrainingRepository],
})
export class LiveTrainingModule {}
