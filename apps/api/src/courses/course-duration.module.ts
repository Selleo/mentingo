import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";

import { CourseDurationRepository } from "./course-duration.repository";
import { CourseDurationService } from "./course-duration.service";
import { CourseDurationHandler } from "./handlers/course-duration.handler";

@Module({
  imports: [LocalizationModule],
  providers: [CourseDurationService, CourseDurationRepository, CourseDurationHandler],
  exports: [CourseDurationService],
})
export class CourseDurationModule {}
