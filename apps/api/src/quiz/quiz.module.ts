import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { QuizAuthoringRepository } from "./repositories/quiz-authoring.repository";
import { QuizRuntimeRepository } from "./repositories/quiz-runtime.repository";
import { QuizAttemptService } from "./services/quiz-attempt.service";
import { QuizAuthoringPersistenceService } from "./services/quiz-authoring-persistence.service";
import { QuizAuthoringService } from "./services/quiz-authoring.service";
import { QuizRuntimeService } from "./services/quiz-runtime.service";

@Module({
  imports: [FileModule, LocalizationModule],
  providers: [
    QuizAuthoringRepository,
    QuizAuthoringService,
    QuizAuthoringPersistenceService,
    QuizRuntimeRepository,
    QuizRuntimeService,
    QuizAttemptService,
  ],
  exports: [
    QuizAuthoringRepository,
    QuizAuthoringService,
    QuizRuntimeRepository,
    QuizRuntimeService,
  ],
})
export class QuizModule {}
