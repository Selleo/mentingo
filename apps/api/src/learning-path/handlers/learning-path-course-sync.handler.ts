import { Injectable } from "@nestjs/common";

import { processInBatches } from "src/common/utils/processInBatches";
import {
  EnrollUserToGroupEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
  LessonCompletedEvent,
  UserCourseFinishedEvent,
  BulkAssignUsersToGroupsEvent,
} from "src/events";
import { GROUP_ENROLLMENT_EVENT_BATCH_SIZE } from "src/group/group.constants";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { LearningPathExportAppliedEvent } from "../events/learning-path-export-applied.event";
import { LearningPathCourseSyncService } from "../services/learning-path-course-sync.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type EventType =
  | EnrollUserToGroupEvent
  | BulkAssignUsersToGroupsEvent
  | LearningPathCourseAddedEvent
  | LearningPathCourseRemovedEvent
  | LearningPathCourseSyncEvent
  | LearningPathExportAppliedEvent
  | LessonCompletedEvent
  | UserCourseFinishedEvent;

const LearningPathCourseEvents = [
  EnrollUserToGroupEvent,
  BulkAssignUsersToGroupsEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
  LearningPathExportAppliedEvent,
  LessonCompletedEvent,
  UserCourseFinishedEvent,
] as const;

@Injectable()
@OutboxEventsHandler(...LearningPathCourseEvents)
export class LearningPathCourseSyncHandler implements OutboxEventsHandlerOf<EventType> {
  constructor(
    private readonly learningPathCourseSyncService: LearningPathCourseSyncService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async handleOutboxEvent(event: EventType) {
    if (event instanceof EnrollUserToGroupEvent) {
      return this.handleEnrollUserToGroup(event);
    }

    if (event instanceof BulkAssignUsersToGroupsEvent) {
      return this.handleBulkAssignUsersToGroups(event);
    }

    if (event instanceof LearningPathCourseAddedEvent) {
      return this.handleLearningPathCourseAdded(event);
    }

    if (event instanceof LearningPathCourseRemovedEvent) {
      return this.handleLearningPathCourseRemoved(event);
    }

    if (event instanceof LearningPathCourseSyncEvent) {
      return this.handleLearningPathCourseSync(event);
    }

    if (event instanceof LessonCompletedEvent) {
      return this.handleLessonCompleted(event);
    }

    return this.handleUserCourseFinished(event);
  }

  private async handleEnrollUserToGroup(event: EnrollUserToGroupEvent) {
    const { groupId, userId, actor } = event.enrollmentData;

    await this.tenantDbRunnerService.runWithTenant(actor.tenantId, async () => {
      await this.learningPathCourseSyncService.syncLearningPathEnrollmentsForGroupMember(
        groupId,
        userId,
        actor.tenantId,
        actor,
      );
    });
  }

  private async handleBulkAssignUsersToGroups(event: BulkAssignUsersToGroupsEvent) {
    const { actor, tenantId, updates } = event.bulkAssignUsersToGroupsData;

    const assignments = updates.flatMap(({ userId, groupIdsToAssign }) =>
      groupIdsToAssign.map((groupId) => ({ groupId, userId })),
    );

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await processInBatches(
        assignments,
        ({ groupId, userId }) =>
          this.learningPathCourseSyncService.syncLearningPathEnrollmentsForGroupMember(
            groupId,
            userId,
            tenantId,
            actor,
          ),
        { batchSize: GROUP_ENROLLMENT_EVENT_BATCH_SIZE },
      );
    });
  }

  private async handleLearningPathCourseAdded(event: LearningPathCourseAddedEvent) {
    const { tenantId, learningPathId } = event.learningPathCourseAddedData;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await this.learningPathCourseSyncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLearningPathCourseRemoved(event: LearningPathCourseRemovedEvent) {
    const { tenantId, learningPathId } = event.learningPathCourseRemovedData;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await this.learningPathCourseSyncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLearningPathCourseSync(event: LearningPathCourseSyncEvent) {
    const { tenantId, learningPathId } = event.learningPathCourseSyncData;

    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await this.learningPathCourseSyncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLessonCompleted(event: LessonCompletedEvent) {
    const { courseId, userId, actor } = event.lessonCompletionData;

    await this.tenantDbRunnerService.runWithTenant(actor.tenantId, async () => {
      await this.learningPathCourseSyncService.syncStudentLearningPathsForStartedCourse(
        userId,
        courseId,
        actor,
      );
    });
  }

  private async handleUserCourseFinished(event: UserCourseFinishedEvent) {
    const { courseId, userId, actor } = event.courseFinishedData;

    await this.tenantDbRunnerService.runWithTenant(actor.tenantId, async () => {
      await this.learningPathCourseSyncService.syncStudentLearningPathsForFinishedCourse(
        userId,
        courseId,
      );
    });
  }
}
