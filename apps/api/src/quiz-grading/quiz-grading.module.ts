import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { QuizModule } from "src/quiz/quiz.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { QuizGradingController } from "./quiz-grading.controller";
import { QuizGradingRepository } from "./quiz-grading.repository";
import { QuizGradingService } from "./quiz-grading.service";

@Module({
  imports: [LocalizationModule, QuizModule, StudentLessonProgressModule],
  controllers: [QuizGradingController],
  providers: [QuizGradingRepository, QuizGradingService],
})
export class QuizGradingModule {}
