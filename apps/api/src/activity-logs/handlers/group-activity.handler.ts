import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  CreateGroupEvent,
  DeleteGroupEvent,
  EnrollGroupToCourseEvent,
  EnrollUserToGroupEvent,
  UpdateGroupEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";
import { buildActivityLogMetadata } from "../utils/build-activity-log-metadata";

type GroupEventType =
  | CreateGroupEvent
  | UpdateGroupEvent
  | DeleteGroupEvent
  | EnrollUserToGroupEvent
  | EnrollGroupToCourseEvent;

const GroupActivityEvents = [
  CreateGroupEvent,
  UpdateGroupEvent,
  DeleteGroupEvent,
  EnrollUserToGroupEvent,
  EnrollGroupToCourseEvent,
] as const;

@Injectable()
@EventsHandler(...GroupActivityEvents)
export class GroupActivityHandler implements IEventHandler<GroupEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: GroupEventType) {
    if (event instanceof CreateGroupEvent) return await this.handleCreate(event);
    if (event instanceof UpdateGroupEvent) return await this.handleUpdate(event);
    if (event instanceof DeleteGroupEvent) return await this.handleDelete(event);
    if (event instanceof EnrollUserToGroupEvent) return await this.handleEnrollUser(event);
    if (event instanceof EnrollGroupToCourseEvent)
      return await this.handleEnrollGroupToCourse(event);
  }

  private async handleCreate(event: CreateGroupEvent) {
    const metadata = buildActivityLogMetadata({
      previous: {},
      updated: event.groupData.group,
      schema: "create",
    });

    await this.activityLogsService.recordActivity({
      actor: event.groupData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.CREATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      resourceId: event.groupData.groupId,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleUpdate(event: UpdateGroupEvent) {
    const metadata = buildActivityLogMetadata({
      previous: event.groupUpdateData.previousGroupData,
      updated: event.groupUpdateData.updatedGroupData,
    });

    await this.activityLogsService.recordActivity({
      actor: event.groupUpdateData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      resourceId: event.groupUpdateData.groupId,
      changedFields: metadata.changedFields,
      before: metadata.before,
      after: metadata.after,
      context: metadata.context ?? null,
    });
  }

  private async handleDelete(event: DeleteGroupEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.deleteGroupData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.DELETE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      resourceId: event.deleteGroupData.groupId,
      context: event.deleteGroupData.groupName
        ? { groupName: event.deleteGroupData.groupName }
        : null,
    });
  }

  private async handleEnrollUser(event: EnrollUserToGroupEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.enrollmentData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.GROUP_ASSIGNMENT,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      resourceId: event.enrollmentData.groupId,
      context: { userId: event.enrollmentData.userId },
    });
  }

  private async handleEnrollGroupToCourse(event: EnrollGroupToCourseEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.enrollmentData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.ENROLL_COURSE,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.GROUP,
      resourceId: event.enrollmentData.groupId,
      context: {
        courseId: event.enrollmentData.courseId,
      },
    });
  }
}
