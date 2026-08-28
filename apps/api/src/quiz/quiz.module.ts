import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { QuizAuthoringRepository } from "./repositories/quiz-authoring.repository";
import { QuizRuntimeRepository } from "./repositories/quiz-runtime.repository";
import { QuizAuthoringService } from "./services/quiz-authoring.service";
import { QuizRuntimeService } from "./services/quiz-runtime.service";

@Module({
  imports: [FileModule, LocalizationModule],
  providers: [
    QuizAuthoringRepository,
    QuizAuthoringService,
    QuizRuntimeRepository,
    QuizRuntimeService,
  ],
  exports: [
    QuizAuthoringRepository,
    QuizAuthoringService,
    QuizRuntimeRepository,
    QuizRuntimeService,
  ],
})
export class QuizModule {}
