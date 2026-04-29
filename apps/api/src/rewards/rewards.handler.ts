import { Inject, Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { REWARD_ACTION_TYPES, REWARD_SOURCE_ENTITY_TYPES } from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import {
  LessonCompletedEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
} from "src/events";
import { RewardsService } from "src/rewards/rewards.service";
import { aiMentorStudentLessonProgress, studentLessonProgress } from "src/storage/schema";

type RewardsEvent = LessonCompletedEvent | UserChapterFinishedEvent | UserCourseFinishedEvent;

@Injectable()
@EventsHandler(LessonCompletedEvent, UserChapterFinishedEvent, UserCourseFinishedEvent)
export class RewardsHandler implements IEventHandler<RewardsEvent> {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly rewardsService: RewardsService,
  ) {}

  async handle(event: RewardsEvent) {
    if (event instanceof UserChapterFinishedEvent) {
      const { chapterFinishedData } = event;

      return this.rewardsService.grantPoints({
        userId: chapterFinishedData.userId,
        actionType: REWARD_ACTION_TYPES.CHAPTER_COMPLETED,
        sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.CHAPTER,
        sourceEntityId: chapterFinishedData.chapterId,
        metadata: { courseId: chapterFinishedData.courseId },
      });
    }

    if (event instanceof UserCourseFinishedEvent) {
      const { courseFinishedData } = event;

      return this.rewardsService.grantPoints({
        userId: courseFinishedData.userId,
        actionType: REWARD_ACTION_TYPES.COURSE_COMPLETED,
        sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.COURSE,
        sourceEntityId: courseFinishedData.courseId,
      });
    }

    if (event instanceof LessonCompletedEvent) {
      return this.handleLessonCompleted(event);
    }
  }

  private async handleLessonCompleted(event: LessonCompletedEvent) {
    const { lessonCompletionData } = event;

    const [passedAiProgress] = await this.db
      .select({ id: aiMentorStudentLessonProgress.id })
      .from(studentLessonProgress)
      .innerJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .where(
        and(
          eq(studentLessonProgress.studentId, lessonCompletionData.userId),
          eq(studentLessonProgress.lessonId, lessonCompletionData.lessonId),
          eq(aiMentorStudentLessonProgress.passed, true),
        ),
      );

    if (!passedAiProgress) return;

    return this.rewardsService.grantPoints({
      userId: lessonCompletionData.userId,
      actionType: REWARD_ACTION_TYPES.AI_CONVERSATION_PASSED,
      sourceEntityType: REWARD_SOURCE_ENTITY_TYPES.LESSON,
      sourceEntityId: lessonCompletionData.lessonId,
      metadata: { courseId: lessonCompletionData.courseId },
    });
  }
}
