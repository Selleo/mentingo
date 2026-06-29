import { Inject } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { MasterCourseService } from "src/courses/master-course.service";
import {
  BulkUpdateCourseCategoryEvent,
  CreateChapterEvent,
  CreateLessonEvent,
  DeleteChapterEvent,
  DeleteLessonEvent,
  UpdateChapterEvent,
  UpdateCourseEvent,
  UpdateLessonEvent,
} from "src/events";
import { chapters, lessons } from "src/storage/schema";

import type { IEventHandler } from "@nestjs/cqrs";

type SyncEvents =
  | BulkUpdateCourseCategoryEvent
  | UpdateCourseEvent
  | CreateChapterEvent
  | UpdateChapterEvent
  | DeleteChapterEvent
  | CreateLessonEvent
  | UpdateLessonEvent
  | DeleteLessonEvent;

@EventsHandler(
  BulkUpdateCourseCategoryEvent,
  UpdateCourseEvent,
  CreateChapterEvent,
  UpdateChapterEvent,
  DeleteChapterEvent,
  CreateLessonEvent,
  UpdateLessonEvent,
  DeleteLessonEvent,
)
export class MasterCourseSyncHandler implements IEventHandler<SyncEvents> {
  constructor(
    private readonly masterCourseService: MasterCourseService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async handle(event: SyncEvents) {
    if (event instanceof BulkUpdateCourseCategoryEvent) {
      await this.queueBulkCourseCategorySync(event);
      return;
    }

    const courseId = await this.resolveCourseId(event);
    if (!courseId) return;
    await this.masterCourseService.queueSyncForSourceCourse(courseId, event.constructor.name);
  }

  private async queueBulkCourseCategorySync(event: BulkUpdateCourseCategoryEvent): Promise<void> {
    const courseIds = [
      ...new Set(event.bulkUpdateCourseCategoryData.updates.map(({ courseId }) => courseId)),
    ];

    await Promise.all(
      courseIds.map((courseId) =>
        this.masterCourseService.queueSyncForSourceCourse(courseId, event.constructor.name),
      ),
    );
  }

  private async resolveCourseId(event: SyncEvents): Promise<string | null> {
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

    const lessonId =
      event instanceof CreateLessonEvent
        ? event.lessonCreationData.lessonId
        : event instanceof UpdateLessonEvent
          ? event.lessonUpdateData.lessonId
          : null;

    if (event instanceof DeleteLessonEvent) return event.deleteLessonData.courseId;
    if (!lessonId) return null;

    const [lesson] = await this.db
      .select({ courseId: chapters.courseId })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    return lesson?.courseId ?? null;
  }
}
