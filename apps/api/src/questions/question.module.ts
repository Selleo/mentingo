import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { StatisticsModule } from "src/statistics/statistics.module";

import { QuestionRepository } from "./question.repository";
import { QuestionService } from "./question.service";

@Module({
  imports: [StatisticsModule, LocalizationModule],
  controllers: [],
  providers: [QuestionService, QuestionRepository],
  exports: [QuestionService, QuestionRepository],
})
export class QuestionsModule {}
