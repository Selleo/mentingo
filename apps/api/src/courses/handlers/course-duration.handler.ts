import { Inject } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { CourseDurationService } from "src/courses/course-duration.service";
import {
  CreateChapterEvent,
  CreateCourseEvent,
  CreateLessonEvent,
  DeleteChapterEvent,
  DeleteLessonEvent,
  UpdateChapterEvent,
  UpdateCourseEvent,
  UpdateLessonEvent,
} from "src/events";
import { chapters, lessons } from "src/storage/schema";

import type { IEventHandler } from "@nestjs/cqrs";
import type { UUIDType } from "src/common";

type CourseDurationEvent =
  | CreateCourseEvent
  | UpdateCourseEvent
  | CreateChapterEvent
  | UpdateChapterEvent
  | DeleteChapterEvent
  | CreateLessonEvent
  | UpdateLessonEvent
  | DeleteLessonEvent;

@EventsHandler(
  CreateCourseEvent,
  UpdateCourseEvent,
  CreateChapterEvent,
  UpdateChapterEvent,
  DeleteChapterEvent,
  CreateLessonEvent,
  UpdateLessonEvent,
  DeleteLessonEvent,
)
export class CourseDurationHandler implements IEventHandler<CourseDurationEvent> {
  constructor(
    private readonly courseDurationService: CourseDurationService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async handle(event: CourseDurationEvent): Promise<void> {
    const courseId = await this.resolveCourseId(event);
    if (!courseId) return;

    await this.courseDurationService.refreshCourseDurationEstimates(courseId);
  }

  private async resolveCourseId(event: CourseDurationEvent): Promise<UUIDType | null> {
    if (event instanceof CreateCourseEvent) return event.courseCreationData.courseId;
    if (event instanceof UpdateCourseEvent) return event.courseUpdateData.courseId;

    if (
      event instanceof CreateChapterEvent ||
      event instanceof UpdateChapterEvent ||
      event instanceof DeleteChapterEvent
    ) {
      if (event instanceof DeleteChapterEvent) return event.deleteChapterData.courseId;

      const chapterId =
        event instanceof CreateChapterEvent
          ? event.chapterCreationData.chapterId
          : event.chapterUpdateData.chapterId;

      const [chapter] = await this.db
        .select({ courseId: chapters.courseId })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);

      return chapter?.courseId ?? null;
    }

    if (event instanceof DeleteLessonEvent) return event.deleteLessonData.courseId;

    const lessonId =
      event instanceof CreateLessonEvent
        ? event.lessonCreationData.lessonId
        : event.lessonUpdateData.lessonId;

    const [lesson] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    return lesson?.courseId ?? null;
  }
}
