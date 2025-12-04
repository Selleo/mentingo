import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  UserCourseFinishedEvent,
  CourseStartedEvent,
  CreateCourseEvent,
  UpdateCourseEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

type CourseEventType =
  | CourseStartedEvent
  | UserCourseFinishedEvent
  | CreateCourseEvent
  | UpdateCourseEvent
  | UserCourseFinishedEvent;

const CourseActivityEvents = [
  CourseStartedEvent,
  UserCourseFinishedEvent,
  CreateCourseEvent,
  UpdateCourseEvent,
  UserCourseFinishedEvent,
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
  }

  private async handleCreateCourse(event: CreateCourseEvent) {
    await this.activityLogsService.recordActivity({
      actorId: event.courseCreationData.createdById,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: event.courseCreationData.courseId,
    });
  }

  private async handleUpdateCourse(event: UpdateCourseEvent) {
    const { courseUpdateData } = event;

    await this.activityLogsService.recordActivity({
      actorId: courseUpdateData.updatedById,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.COURSE,
      resourceId: courseUpdateData.courseId,
      changedFields: courseUpdateData.metadata.changedFields,
      before: courseUpdateData.metadata.before,
      after: courseUpdateData.metadata.after,
      context: courseUpdateData.metadata.context ?? null,
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
}
