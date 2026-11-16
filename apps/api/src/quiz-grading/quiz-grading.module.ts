import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { EmailModule } from "src/common/emails/emails.module";
import { LocalizationModule } from "src/localization/localization.module";
import { QuizModule } from "src/quiz/quiz.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

import { QuizAttemptGradedNotificationHandler } from "./handlers/quiz-attempt-graded-notification.handler";
import { QuizGradingDigestService } from "./quiz-grading-digest.service";
import { QuizGradingController } from "./quiz-grading.controller";
import { QuizGradingCron } from "./quiz-grading.cron";
import { QuizGradingRepository } from "./quiz-grading.repository";
import { QuizGradingService } from "./quiz-grading.service";

@Module({
  imports: [
    AnnouncementsModule,
    EmailModule,
    LocalizationModule,
    QuizModule,
    StudentLessonProgressModule,
  ],
  controllers: [QuizGradingController],
  providers: [
    QuizGradingRepository,
    QuizGradingService,
    QuizGradingDigestService,
    QuizGradingCron,
    QuizAttemptGradedNotificationHandler,
  ],
})
export class QuizGradingModule {}
