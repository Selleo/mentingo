import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  UserCourseFinishedEvent,
  CourseStartedEvent,
  CreateCourseEvent,
  UpdateCourseEvent,
  EnrollCourseEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type CourseEventType =
  | CourseStartedEvent
  | UserCourseFinishedEvent
  | CreateCourseEvent
  | UpdateCourseEvent
  | UserCourseFinishedEvent
  | EnrollCourseEvent;

const CourseActivityEvents = [
  CourseStartedEvent,
  UserCourseFinishedEvent,
  CreateCourseEvent,
  UpdateCourseEvent,
  UserCourseFinishedEvent,
  EnrollCourseEvent,
] as const;

@Injectable()
@EventsHandler(...CourseActivityEvents)
export class CourseActivityHandler implements IEventHandler<CourseEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: CourseEventType) {
    if (event instanceof CourseStartedEvent) return await this.handleCourseStarted(event);

    if (event instanceof UserCourseFinishedEvent) return await this.handleUserCourseFinished(event);

    if (event instanceof CreateCourseEvent) return await this.handleCreateCourse(event);

    if (event instanceof UpdateCourseEvent) return await this.handleUpdateCourse(event);

    if (event instanceof EnrollCourseEvent) return await this.handleEnrollCourse(event);
  }

  private async handleCreateCourse(event: CreateCourseEvent) {
    const context: Record<string, string> = {
      status: event.courseCreationData.createdCourse.status ?? "",
    };

    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.courseCreationData.createdCourse,
      schema: "create",
      context,
    });

    await this.activityLogsService.recordActivity({
      actorId: event.courseCreationData.createdById,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: event.courseCreationData.courseId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdateCourse(event: UpdateCourseEvent) {
    const { courseUpdateData } = event;

    const context: Record<string, string> = {
      status:
        courseUpdateData.updatedCourseData?.status ??
        courseUpdateData.previousCourseData?.status ??
        "",
    };

    const metadata = buildActivityLogMetadata({
      previous: courseUpdateData.previousCourseData,
      updated: courseUpdateData.updatedCourseData,
      context,
    });

    await this.activityLogsService.recordActivity({
      actorId: courseUpdateData.updatedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: courseUpdateData.courseId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleCourseStarted(event: CourseStartedEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.userId,
      operation: ACTIVITY_LOG_ACTION_TYPES.START_COURSE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: event.courseId,
    });
  }

  private async handleUserCourseFinished(event: UserCourseFinishedEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.courseFinishedData.userId,
      operation: ACTIVITY_LOG_ACTION_TYPES.COMPLETE_COURSE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: event.courseFinishedData.courseId,
    });
  }

  private async handleEnrollCourse(event: EnrollCourseEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.enrollmentData.enrolledById ?? event.enrollmentData.userId,
      operation: ACTIVITY_LOG_ACTION_TYPES.ENROLL_COURSE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: event.enrollmentData.courseId,
      context:
        event.enrollmentData.userId !== event.enrollmentData.enrolledById
          ? { enrolledUserId: event.enrollmentData.userId }
          : null,
    });
  }
}
