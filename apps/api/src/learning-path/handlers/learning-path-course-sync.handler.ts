import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  EnrollUserToGroupEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
  UserCourseFinishedEvent,
} from "src/events";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { LearningPathCourseSyncService } from "../services/learning-path-course-sync.service";

type EventType =
  | EnrollUserToGroupEvent
  | LearningPathCourseAddedEvent
  | LearningPathCourseRemovedEvent
  | LearningPathCourseSyncEvent
  | UserCourseFinishedEvent;

const LearningPathCourseEvents = [
  EnrollUserToGroupEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
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

    if (event instanceof LearningPathCourseAddedEvent) {
      return this.handleLearningPathCourseAdded(event);
    }

    if (event instanceof LearningPathCourseRemovedEvent) {
      return this.handleLearningPathCourseRemoved(event);
    }

    if (event instanceof LearningPathCourseSyncEvent) {
      return this.handleLearningPathCourseSync(event);
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

  private async handleUserCourseFinished(event: UserCourseFinishedEvent) {
    const { courseId, userId, actor } = event.courseFinishedData;

    await this.tenantRunner.runWithTenant(actor.tenantId, async () => {
      await this.syncService.syncStudentLearningPathsForFinishedCourse(userId, courseId);
    });
  }
}
