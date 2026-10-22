import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { CourseModule } from "src/courses/course.module";
import { LearningFactsRepository } from "src/integration/repositories/learning-facts.repository";
import { LocalizationService } from "src/localization/localization.service";
import { UserModule } from "src/user/user.module";

import { CompetenciesAssignmentService } from "./competencies-assignment.service";
import { CompetenciesClientService } from "./competencies-client.service";
import { CompetenciesSyncService } from "./competencies-sync.service";
import { CompetenciesController } from "./competencies.controller";
import { CompetenciesService } from "./competencies.service";
import { CompetenciesWorker } from "./competencies.worker";
import { CompetenciesCertificatesHandler } from "./handlers/competencies-certificates.handler";
import { CompetenciesLearningHandler } from "./handlers/competencies-learning.handler";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";

@Module({
  imports: [CqrsModule, CourseModule, UserModule],
  controllers: [CompetenciesController],
  providers: [
    CompetenciesClientService,
    CompetenciesService,
    CompetenciesContextRepository,
    LocalizationService,
    LearningFactsRepository,
    CompetenciesAssignmentService,
    CompetenciesSyncService,
    CompetenciesWorker,
    CompetenciesLearningHandler,
    CompetenciesCertificatesHandler,
  ],
  exports: [CompetenciesClientService],
})
export class CompetenciesModule {}
