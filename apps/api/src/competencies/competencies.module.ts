import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { LearningFactsRepository } from "src/integration/repositories/learning-facts.repository";
import { LocalizationService } from "src/localization/localization.service";
import { UserModule } from "src/user/user.module";

import { CompetenciesClientService } from "./competencies-client.service";
import { CompetenciesPeopleSyncService } from "./competencies-people-sync.service";
import { CompetenciesSyncService } from "./competencies-sync.service";
import { CompetenciesController } from "./competencies.controller";
import { CompetenciesService } from "./competencies.service";
import { CompetenciesWorker } from "./competencies.worker";
import { CompetenciesCertificatesHandler } from "./handlers/competencies-certificates.handler";
import { CompetenciesLearningHandler } from "./handlers/competencies-learning.handler";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";

@Module({
  imports: [CqrsModule, UserModule],
  controllers: [CompetenciesController],
  providers: [
    CompetenciesClientService,
    CompetenciesService,
    CompetenciesContextRepository,
    LocalizationService,
    LearningFactsRepository,
    CompetenciesPeopleSyncService,
    CompetenciesSyncService,
    CompetenciesWorker,
    CompetenciesLearningHandler,
    CompetenciesCertificatesHandler,
  ],
  exports: [CompetenciesClientService],
})
export class CompetenciesModule {}
