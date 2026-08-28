import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { QuizAuthoringRepository } from "./repositories/quiz-authoring.repository";
import { QuizAuthoringService } from "./services/quiz-authoring.service";

@Module({
  imports: [FileModule, LocalizationModule],
  providers: [QuizAuthoringRepository, QuizAuthoringService],
  exports: [QuizAuthoringRepository, QuizAuthoringService],
})
export class QuizModule {}
