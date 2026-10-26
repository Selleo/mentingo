import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";

import { CourseDurationHandler } from "./course-duration.handler";
import { CourseDurationRepository } from "./course-duration.repository";
import { CourseDurationService } from "./course-duration.service";

@Module({
  imports: [LocalizationModule],
  providers: [CourseDurationService, CourseDurationRepository, CourseDurationHandler],
  exports: [CourseDurationService],
})
export class CourseDurationModule {}
