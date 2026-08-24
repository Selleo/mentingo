import { EventsHandler } from "@nestjs/cqrs";

import { CourseDurationRepository } from "src/courses/course-duration.repository";
import { CourseDurationService } from "src/courses/course-duration.service";
import {
  CreateChapterEvent,
  CreateCourseEvent,
  CourseDurationRefreshRequestedEvent,
  CreateLessonEvent,
  DeleteChapterEvent,
  DeleteLessonEvent,
  UpdateChapterEvent,
  UpdateCourseEvent,
  UpdateLessonEvent,
  ResourceVideoDurationUpdatedEvent,
} from "src/events";

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
  | DeleteLessonEvent
  | ResourceVideoDurationUpdatedEvent
  | CourseDurationRefreshRequestedEvent;

@EventsHandler(
  CreateCourseEvent,
  UpdateCourseEvent,
  CreateChapterEvent,
  UpdateChapterEvent,
  DeleteChapterEvent,
  CreateLessonEvent,
  UpdateLessonEvent,
  DeleteLessonEvent,
  ResourceVideoDurationUpdatedEvent,
  CourseDurationRefreshRequestedEvent,
)
export class CourseDurationHandler implements IEventHandler<CourseDurationEvent> {
  constructor(
    private readonly courseDurationService: CourseDurationService,
    private readonly courseDurationRepository: CourseDurationRepository,
  ) {}

  async handle(event: CourseDurationEvent): Promise<void> {
    if (event instanceof ResourceVideoDurationUpdatedEvent) {
      await this.courseDurationService.refreshCoursesForResource(
        event.resourceVideoDurationUpdatedData.resourceId,
      );
      return;
    }
    if (event instanceof CourseDurationRefreshRequestedEvent) {
      await this.courseDurationService.refreshCourseDurationEstimates(
        event.courseDurationRefreshRequestedData.courseId,
      );
      return;
    }
    const courseId = await this.resolveCourseId(event);
    if (!courseId) return;

    await this.courseDurationService.refreshCourseDurationEstimates(courseId);
  }

  private async resolveCourseId(event: CourseDurationEvent): Promise<UUIDType | null> {
    if (event instanceof ResourceVideoDurationUpdatedEvent) return null;
    if (event instanceof CourseDurationRefreshRequestedEvent) return null;
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

      const [chapter] = await this.courseDurationRepository.getCourseIdByChapterId(chapterId);

      return chapter?.courseId ?? null;
    }

    if (event instanceof DeleteLessonEvent) return event.deleteLessonData.courseId;

    const lessonId =
      event instanceof CreateLessonEvent
        ? event.lessonCreationData.lessonId
        : event.lessonUpdateData.lessonId;

    const [lesson] = await this.courseDurationRepository.getCourseIdByLessonId(lessonId);

    return lesson?.courseId ?? null;
  }
}
