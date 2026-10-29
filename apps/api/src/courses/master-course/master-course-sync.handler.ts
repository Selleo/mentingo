import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { MasterCourseService } from "src/courses/master-course/master-course.service";
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
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";
import { chapters, lessons } from "src/storage/schema";

type SyncEvents =
  | BulkUpdateCourseCategoryEvent
  | UpdateCourseEvent
  | CreateChapterEvent
  | UpdateChapterEvent
  | DeleteChapterEvent
  | CreateLessonEvent
  | UpdateLessonEvent
  | DeleteLessonEvent;

@Injectable()
export class MasterCourseSyncHandler implements OnModuleInit {
  constructor(
    private readonly masterCourseService: MasterCourseService,
    @Inject("DB") private readonly db: DatabasePg,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
  ) {}

  onModuleInit(): void {
    const events = [
      BulkUpdateCourseCategoryEvent,
      UpdateCourseEvent,
      CreateChapterEvent,
      UpdateChapterEvent,
      DeleteChapterEvent,
      CreateLessonEvent,
      UpdateLessonEvent,
      DeleteLessonEvent,
    ];
    for (const event of events) {
      this.outboxDirectHandlerService.registerReaction(event.name, async (payload) => {
        await this.handle(materializeLegacyEvent(event.name, payload) as SyncEvents);
      });
    }
  }

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

    if (event instanceof DeleteLessonEvent) return event.deleteLessonData.courseId;
    let lessonId: string | null = null;
    if (event instanceof CreateLessonEvent) lessonId = event.lessonCreationData.lessonId;
    if (event instanceof UpdateLessonEvent) lessonId = event.lessonUpdateData.lessonId;
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
