import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

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
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { LearningPathCourseSyncService } from "../services/learning-path-course-sync.service";

type EventType =
  | EnrollUserToGroupEvent
  | BulkAssignUsersToGroupsEvent
  | LearningPathCourseAddedEvent
  | LearningPathCourseRemovedEvent
  | LearningPathCourseSyncEvent
  | LessonCompletedEvent
  | UserCourseFinishedEvent;

const LearningPathCourseEvents = [
  EnrollUserToGroupEvent,
  BulkAssignUsersToGroupsEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
  LessonCompletedEvent,
  UserCourseFinishedEvent,
] as const;

@Injectable()
@EventsHandler(...LearningPathCourseEvents)
export class LearningPathCourseSyncHandler implements IEventHandler<EventType> {
  constructor(
    private readonly syncService: LearningPathCourseSyncService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: EventType) {
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

    await this.tenantRunner.runWithTenant(actor.tenantId, async () => {
      await this.syncService.syncLearningPathEnrollmentsForGroupMember(
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

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      await processInBatches(
        assignments,
        ({ groupId, userId }) =>
          this.syncService.syncLearningPathEnrollmentsForGroupMember(
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

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      await this.syncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLearningPathCourseRemoved(event: LearningPathCourseRemovedEvent) {
    const { tenantId, learningPathId } = event.learningPathCourseRemovedData;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      await this.syncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLearningPathCourseSync(event: LearningPathCourseSyncEvent) {
    const { tenantId, learningPathId } = event.learningPathCourseSyncData;

    await this.tenantRunner.runWithTenant(tenantId, async () => {
      await this.syncService.syncLearningPathEnrollments(learningPathId);
    });
  }

  private async handleLessonCompleted(event: LessonCompletedEvent) {
    const { courseId, userId, actor } = event.lessonCompletionData;

    await this.tenantRunner.runWithTenant(actor.tenantId, async () => {
      await this.syncService.syncStudentLearningPathsForStartedCourse(userId, courseId, actor);
    });
  }

  private async handleUserCourseFinished(event: UserCourseFinishedEvent) {
    const { courseId, userId, actor } = event.courseFinishedData;

    await this.tenantRunner.runWithTenant(actor.tenantId, async () => {
      await this.syncService.syncStudentLearningPathsForFinishedCourse(userId, courseId);
    });
  }
}
